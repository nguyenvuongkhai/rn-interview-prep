import type { Duration } from '../core/sessionBuilder';
import type { Attempt, ReviewState } from '../core/types';

export type SessionMode = 'daily' | 'practice' | 'interview';

export interface SessionRecord {
  id: string;
  /** local calendar day, YYYY-MM-DD */
  date: string;
  mode: SessionMode;
  durationMin: Duration;
  itemIds: string[];
  /** epoch ms */
  startedAt: number;
  finishedAt?: number;
  overtimeSec: number;
}

export interface DraftRecord {
  challengeId: string;
  code: string;
  updatedAt: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

/** Everything the app stores, as exported to and imported from a backup file. */
export interface Snapshot {
  sessions: SessionRecord[];
  attempts: Attempt[];
  reviews: ReviewState[];
  drafts: DraftRecord[];
  settings: SettingRecord[];
}

/** The only door to persisted data. Two implementations: Dexie (real) and memory (tests, blocked storage). */
export interface Repo {
  getSession(id: string): Promise<SessionRecord | undefined>;
  putSession(session: SessionRecord): Promise<void>;
  findSessions(date: string): Promise<SessionRecord[]>;
  /** oldest first */
  listSessions(): Promise<SessionRecord[]>;
  /** oldest first */
  listAttempts(): Promise<Attempt[]>;
  addAttempt(attempt: Attempt): Promise<void>;
  listReviews(): Promise<ReviewState[]>;
  getReview(itemId: string): Promise<ReviewState | undefined>;
  putReview(review: ReviewState): Promise<void>;
  getDraft(challengeId: string): Promise<string | undefined>;
  putDraft(challengeId: string, code: string): Promise<void>;
  getSetting<T>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: unknown): Promise<void>;
  exportAll(): Promise<Snapshot>;
  /** replaces all stored data with the snapshot */
  importAll(snapshot: Snapshot): Promise<void>;
}

export const byStart = (a: SessionRecord, b: SessionRecord) => a.startedAt - b.startedAt;
const byTime = (a: Attempt, b: Attempt) => a.at - b.at;

export function createMemoryRepo(): Repo {
  let sessions = new Map<string, SessionRecord>();
  let attempts: Attempt[] = [];
  let reviews = new Map<string, ReviewState>();
  let drafts = new Map<string, DraftRecord>();
  let settings = new Map<string, unknown>();
  return {
    async getSession(id) {
      return sessions.get(id);
    },
    async putSession(session) {
      sessions.set(session.id, session);
    },
    async findSessions(date) {
      return [...sessions.values()].filter((s) => s.date === date);
    },
    async listSessions() {
      return [...sessions.values()].sort(byStart);
    },
    async listAttempts() {
      return [...attempts].sort(byTime);
    },
    async addAttempt(attempt) {
      attempts.push(attempt);
    },
    async listReviews() {
      return [...reviews.values()];
    },
    async getReview(itemId) {
      return reviews.get(itemId);
    },
    async putReview(review) {
      reviews.set(review.itemId, review);
    },
    async getDraft(challengeId) {
      return drafts.get(challengeId)?.code;
    },
    async putDraft(challengeId, code) {
      drafts.set(challengeId, { challengeId, code, updatedAt: Date.now() });
    },
    async getSetting<T>(key: string) {
      return settings.get(key) as T | undefined;
    },
    async setSetting(key, value) {
      settings.set(key, value);
    },
    async exportAll() {
      return {
        sessions: [...sessions.values()].sort(byStart),
        attempts: [...attempts].sort(byTime),
        reviews: [...reviews.values()],
        drafts: [...drafts.values()],
        settings: [...settings].map(([key, value]) => ({ key, value })),
      };
    },
    async importAll(snapshot) {
      sessions = new Map(snapshot.sessions.map((s) => [s.id, s]));
      attempts = [...snapshot.attempts];
      reviews = new Map(snapshot.reviews.map((r) => [r.itemId, r]));
      drafts = new Map(snapshot.drafts.map((d) => [d.challengeId, d]));
      settings = new Map(snapshot.settings.map((s) => [s.key, s.value]));
    },
  };
}
