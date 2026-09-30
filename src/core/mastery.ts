import type { Item, Topic } from './schema';
import { DAY_MS, type Attempt, type Confidence } from './types';

export const CONFIDENCE_FACTOR: Record<Confidence, number> = { guess: 0.5, fairly: 0.85, sure: 1 };
export const DIFFICULTY_WEIGHT: Record<Item['difficulty'], number> = { 1: 1, 2: 1.5, 3: 2 };
export const HALF_LIFE_DAYS = 14;
export const SLOW_PENALTY = 0.1;
export const MIN_ATTEMPTS = 3;

export type Level = 'insufficient' | 'weak' | 'learning' | 'solid';

export interface Mastery {
  /** 0..1, null when there is nothing to average */
  value: number | null;
  count: number;
  level: Level;
}

export function effectiveScore(a: Attempt, item: Item): number {
  let s = a.score * CONFIDENCE_FACTOR[a.confidence];
  if (a.timeSpent > 2 * item.estSeconds) s -= SLOW_PENALTY;
  return Math.min(1, Math.max(0, s));
}

export function attemptWeight(a: Attempt, item: Item, now: number): number {
  const ageDays = Math.max(0, (now - a.at) / DAY_MS);
  return DIFFICULTY_WEIGHT[item.difficulty] * 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

export function levelOf(value: number | null, count: number): Level {
  if (value === null || count < MIN_ATTEMPTS) return 'insufficient';
  if (value < 0.5) return 'weak';
  if (value < 0.8) return 'learning';
  return 'solid';
}

export function masteryOf(attempts: Attempt[], itemsById: Map<string, Item>, now: number): Mastery {
  let sum = 0;
  let weights = 0;
  let count = 0;
  for (const a of attempts) {
    const item = itemsById.get(a.itemId);
    if (!item) continue;
    const w = attemptWeight(a, item, now);
    sum += w * effectiveScore(a, item);
    weights += w;
    count += 1;
  }
  const value = weights > 0 ? sum / weights : null;
  return { value, count, level: levelOf(value, count) };
}

/** Attempts whose item is tagged with `topicId` (primary or secondary), optionally narrowed by item. */
export function attemptsForTopic(
  topicId: string,
  attempts: Attempt[],
  itemsById: Map<string, Item>,
  filter?: (item: Item) => boolean,
): Attempt[] {
  return attempts.filter((a) => {
    const item = itemsById.get(a.itemId);
    return item !== undefined && item.topics.includes(topicId) && (!filter || filter(item));
  });
}

/** Mastery for every topic. A parent is the weight-averaged mastery of its children plus its own direct attempts. */
export function masteryByTopic(
  topics: Topic[],
  attempts: Attempt[],
  itemsById: Map<string, Item>,
  now: number,
): Map<string, Mastery> {
  const children = new Map<string, Topic[]>();
  for (const t of topics) {
    if (t.parent !== null) children.set(t.parent, [...(children.get(t.parent) ?? []), t]);
  }

  const out = new Map<string, Mastery>();
  const visit = (t: Topic): Mastery => {
    const cached = out.get(t.id);
    if (cached) return cached;

    const own = masteryOf(attemptsForTopic(t.id, attempts, itemsById), itemsById, now);
    const kids = children.get(t.id) ?? [];
    let result = own;
    if (kids.length > 0) {
      let sum = own.value !== null ? own.value * t.weight : 0;
      let weights = own.value !== null ? t.weight : 0;
      let count = own.count;
      for (const k of kids) {
        const m = visit(k);
        count += m.count;
        if (m.value !== null) {
          sum += m.value * k.weight;
          weights += k.weight;
        }
      }
      const value = weights > 0 ? sum / weights : null;
      result = { value, count, level: levelOf(value, count) };
    }
    out.set(t.id, result);
    return result;
  };

  topics.forEach(visit);
  return out;
}
