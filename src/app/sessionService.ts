import type { Content } from '../content/load';
import { grade, type Response } from '../core/grading';
import { masteryByTopic, type Mastery } from '../core/mastery';
import { diagnose, topGaps, type Gap } from '../core/recommend';
import { nextReview } from '../core/scheduler';
import { buildSession, type Duration, type SessionPlan } from '../core/sessionBuilder';
import type { Attempt, Confidence, Lang, Picked, ReviewState } from '../core/types';
import type { Repo, SessionRecord, Snapshot } from '../storage/repo';
import { toBackup, type Backup } from './backup';
import { localDate } from './dates';

export { localDate };

export interface AnswerInput {
  sessionId: string;
  itemId: string;
  response: Response;
  confidence: Confidence;
  /** seconds */
  timeSpent: number;
  lang: Lang;
  now: number;
}

export interface Overview {
  daily?: SessionRecord;
  plan: SessionPlan;
  gaps: Gap[];
  misconceptions: { id: string; occurrences: number }[];
}

export interface LoadedSession {
  session: SessionRecord;
  attempts: Attempt[];
}

export interface Stats {
  attempts: Attempt[];
  sessions: SessionRecord[];
  mastery: Map<string, Mastery>;
}

interface History {
  attempts: Attempt[];
  reviews: ReviewState[];
  mastery: Map<string, Mastery>;
}

function pickedFrom(response: Response): Picked | undefined {
  switch (response.type) {
    case 'mcq':
      return { selected: response.selected };
    case 'spot-bug':
      return {
        ...(response.line !== null ? { line: response.line } : {}),
        ...(response.cause !== null ? { cause: response.cause } : {}),
      };
    case 'open':
      return { hitKeyPoints: response.hitKeyPoints };
    case 'challenge':
      return undefined;
  }
}

/** Items in one topic-practice run from the Library or a Lesson. */
export const TOPIC_PRACTICE_LIMIT = 8;

export function createSessionService(repo: Repo, content: Content) {
  const byId = new Map(content.items.map((i) => [i.id, i]));

  async function history(now: number): Promise<History> {
    const [attempts, reviews] = await Promise.all([repo.listAttempts(), repo.listReviews()]);
    return { attempts, reviews, mastery: masteryByTopic(content.topics, attempts, byId, now) };
  }

  /** The first session of a day is the Daily; later ones are practice with their own seed. */
  async function today(now: number) {
    const date = localDate(now);
    const sessions = await repo.findSessions(date);
    const daily = sessions.find((s) => s.mode === 'daily');
    return { date, daily, seed: daily ? `${date}#${sessions.length}` : date };
  }

  function plan(duration: Duration, seed: string, now: number, h: History): SessionPlan {
    return buildSession({ duration, date: seed, now, items: content.items, attempts: h.attempts, reviews: h.reviews, mastery: h.mastery });
  }

  /** A short practice run over chosen items, e.g. a gap's plan from the Result screen. */
  async function startPractice(itemIds: string[], now: number): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: crypto.randomUUID(), date: localDate(now), mode: 'practice', durationMin: 15,
      itemIds, startedAt: now, overtimeSec: 0,
    };
    await repo.putSession(session);
    return session;
  }

  return {
    async overview(duration: Duration, now: number): Promise<Overview> {
      const [{ daily, seed }, h] = await Promise.all([today(now), history(now)]);
      const gaps = topGaps({ topics: content.topics, mastery: h.mastery, items: content.items, lessons: content.lessons, attempts: h.attempts });
      const misconceptions = diagnose(content.topics, h.attempts, byId, now).flatMap((d) =>
        d.code === 'misconception' ? [{ id: d.misconceptionId, occurrences: d.occurrences }] : [],
      );
      return { daily, plan: plan(duration, seed, now, h), gaps, misconceptions };
    },

    async start(duration: Duration, now: number): Promise<SessionRecord> {
      const [{ date, daily, seed }, h] = await Promise.all([today(now), history(now)]);
      const session: SessionRecord = {
        id: crypto.randomUUID(), date, mode: daily ? 'practice' : 'daily', durationMin: duration,
        itemIds: plan(duration, seed, now, h).itemIds, startedAt: now, overtimeSec: 0,
      };
      await repo.putSession(session);
      return session;
    },

    startPractice,

    async startTopicPractice(topicId: string, now: number): Promise<SessionRecord> {
      const itemIds = content.items.filter((i) => i.topics[0] === topicId).slice(0, TOPIC_PRACTICE_LIMIT).map((i) => i.id);
      if (itemIds.length === 0) throw new Error(`No items for topic "${topicId}"`);
      return startPractice(itemIds, now);
    },

    async load(sessionId: string): Promise<LoadedSession | undefined> {
      const session = await repo.getSession(sessionId);
      if (!session) return undefined;
      const attempts = (await repo.listAttempts()).filter((a) => a.sessionId === sessionId);
      return { session, attempts };
    },

    async stats(now: number): Promise<Stats> {
      const [attempts, sessions] = await Promise.all([repo.listAttempts(), repo.listSessions()]);
      return { attempts, sessions, mastery: masteryByTopic(content.topics, attempts, byId, now) };
    },

    listAttempts: () => repo.listAttempts(),
    loadDraft: (challengeId: string) => repo.getDraft(challengeId),
    saveDraft: (challengeId: string, code: string) => repo.putDraft(challengeId, code),

    async exportBackup(now: number): Promise<Backup> {
      return toBackup(await repo.exportAll(), now);
    },
    importBackup: (snapshot: Snapshot) => repo.importAll(snapshot),

    async answer(input: AnswerInput): Promise<Attempt> {
      const { sessionId, itemId, response, confidence, timeSpent, lang, now } = input;
      const item = byId.get(itemId);
      if (!item) throw new Error(`Unknown item "${itemId}"`);
      const { score, misconceptionIds } = grade(item, response);
      const attempt: Attempt = {
        id: crypto.randomUUID(), itemId, sessionId, score, timeSpent, confidence, lang, at: now, misconceptionIds,
        usedHints: response.type === 'challenge' ? response.usedHints : 0,
        ...(response.type === 'challenge' ? { testResults: response.tests } : {}),
        ...(pickedFrom(response) ? { picked: pickedFrom(response) } : {}),
      };
      await repo.addAttempt(attempt);
      await repo.putReview(nextReview(await repo.getReview(itemId), itemId, score, confidence, now));
      return attempt;
    },

    async finish(sessionId: string, now: number): Promise<SessionRecord> {
      const session = await repo.getSession(sessionId);
      if (!session) throw new Error(`Unknown session "${sessionId}"`);
      if (session.finishedAt !== undefined) return session;
      const elapsed = Math.round((now - session.startedAt) / 1000);
      const done = { ...session, finishedAt: now, overtimeSec: Math.max(0, elapsed - session.durationMin * 60) };
      await repo.putSession(done);
      return done;
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
