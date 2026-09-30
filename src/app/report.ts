import type { Content } from '../content/load';
import { masteryByTopic } from '../core/mastery';
import { diagnose, topGaps, type Diagnosis, type Gap } from '../core/recommend';
import { PASS_SCORE } from '../core/scheduler';
import type { Item, Localized, Option } from '../core/schema';
import type { Attempt } from '../core/types';

export interface TopicDelta {
  topicId: string;
  before: number | null;
  after: number | null;
}

export interface SessionReport {
  /** mean score, 0..1 */
  score: number;
  correct: number;
  total: number;
  timeSpentSec: number;
  guessedCorrect: number;
  deltas: TopicDelta[];
  gaps: Gap[];
  diagnoses: Diagnosis[];
  wrong: { item: Item; attempt: Attempt }[];
}

export function buildReport(content: Content, attempts: Attempt[], sessionId: string, now: number): SessionReport {
  const byId = new Map(content.items.map((i) => [i.id, i]));
  const own = attempts.filter((a) => a.sessionId === sessionId);
  const before = masteryByTopic(content.topics, attempts.filter((a) => a.sessionId !== sessionId), byId, now);
  const after = masteryByTopic(content.topics, attempts, byId, now);
  const touched = [...new Set(own.flatMap((a) => byId.get(a.itemId)?.topics.slice(0, 1) ?? []))].sort();
  const correct = own.filter((a) => a.score >= PASS_SCORE);

  return {
    score: own.length > 0 ? own.reduce((s, a) => s + a.score, 0) / own.length : 0,
    correct: correct.length,
    total: own.length,
    timeSpentSec: own.reduce((s, a) => s + a.timeSpent, 0),
    guessedCorrect: correct.filter((a) => a.confidence === 'guess').length,
    deltas: touched.map((topicId) => ({
      topicId,
      before: before.get(topicId)?.value ?? null,
      after: after.get(topicId)?.value ?? null,
    })),
    gaps: topGaps({ topics: content.topics, mastery: after, items: content.items, lessons: content.lessons, attempts }),
    diagnoses: diagnose(content.topics, attempts, byId, now),
    wrong: own
      .filter((a) => a.score < PASS_SCORE)
      .flatMap((attempt) => {
        const item = byId.get(attempt.itemId);
        return item ? [{ item, attempt }] : [];
      }),
  };
}

export function misconceptionText(content: Content, id: string): Localized | undefined {
  for (const item of content.items) {
    const options: Option[] = item.type === 'mcq' ? item.options : item.type === 'spot-bug' ? item.causeOptions : [];
    const hit = options.find((o) => o.misconception?.id === id);
    if (hit?.misconception) return hit.misconception.text;
  }
  return undefined;
}
