import type { Mastery } from '../core/mastery';
import { hashString, mulberry32, shuffle } from '../core/random';
import type { Item, Topic } from '../core/schema';
import type { Duration } from '../core/sessionBuilder';
import { DAY_MS, type Attempt } from '../core/types';
import type { InterviewCount } from './settings';

export type InterviewScope = { kind: 'weak' } | { kind: 'all' } | { kind: 'group'; group: string };

/** An interview session keeps the Duration type: 3, 5 or 8 questions map to 15, 30 or 45 minutes. */
export const INTERVIEW_DURATION: Record<InterviewCount, Duration> = { 3: 15, 5: 30, 8: 45 };
export const INTERVIEW_RECENT_MS = DAY_MS;

export class EmptyInterviewError extends Error {
  constructor() {
    super('No open questions in this scope');
    this.name = 'EmptyInterviewError';
  }
}

export interface PickInput {
  items: Item[];
  topics: Topic[];
  attempts: Attempt[];
  mastery: Map<string, Mastery>;
  scope: InterviewScope;
  count: InterviewCount;
  now: number;
  seed: string;
}

/** Open questions for one interview: weak topics, then unexplored ones, then the rest. Recent items go last. */
export function pickInterview(input: PickInput): string[] {
  const { items, topics, attempts, mastery, scope, count, now, seed } = input;
  const rng = mulberry32(hashString(seed));
  const groupOf = new Map(topics.map((t) => [t.id, t.group]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const pool = items.filter(
    (i) => i.type === 'open' && (scope.kind !== 'group' || groupOf.get(i.topics[0]) === scope.group),
  );
  const recent = new Set(attempts.filter((a) => now - a.at < INTERVIEW_RECENT_MS).map((a) => a.itemId));
  const seenTopics = new Set<string>();
  for (const a of attempts) {
    const topicId = byId.get(a.itemId)?.topics[0];
    if (topicId) seenTopics.add(topicId);
  }

  const value = (i: Item) => mastery.get(i.topics[0])?.value ?? 1;
  const rank = (i: Item): number => {
    if (scope.kind === 'all') return 0;
    const level = mastery.get(i.topics[0])?.level;
    if (level === 'weak' || level === 'learning') return 0;
    return seenTopics.has(i.topics[0]) ? 2 : 1;
  };
  const weakFirst = scope.kind !== 'all';

  // stable sort keeps the seeded shuffle order among equals
  const ordered = shuffle(pool, rng).sort(
    (a, b) =>
      Number(recent.has(a.id)) - Number(recent.has(b.id)) ||
      rank(a) - rank(b) ||
      (weakFirst && rank(a) === 0 ? value(a) - value(b) : 0),
  );
  return ordered.slice(0, count).map((i) => i.id);
}
