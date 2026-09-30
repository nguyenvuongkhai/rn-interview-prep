import type { Difficulty, Item } from './schema';
import { DAY_MS, type Attempt, type ReviewState } from './types';
import type { Mastery } from './mastery';
import { dueItemIds } from './scheduler';
import { hashString, mulberry32, shuffle } from './random';

export type Duration = 15 | 30 | 45;

interface ChallengeSlot {
  maxSeconds?: number;
  difficulties?: Difficulty[];
}

interface Mix {
  quick: number;
  open: number;
  challenges: ChallengeSlot[];
}

export const MIX: Record<Duration, Mix> = {
  15: { quick: 8, open: 0, challenges: [{ maxSeconds: 300 }] },
  30: { quick: 10, open: 1, challenges: [{ difficulties: [1, 2] }] },
  45: { quick: 12, open: 1, challenges: [{ difficulties: [1, 2] }, { difficulties: [3] }] },
};

/** Share of quick-question slots per bucket, in priority order. Unfilled slots spill to the next bucket. */
export const BUCKETS = [
  ['due', 0.3],
  ['weak', 0.4],
  ['unexplored', 0.2],
  ['stretch', 0.1],
] as const;

export const TOLERANCE = 0.1;
export const RECENT_MS = DAY_MS;

export interface BuildInput {
  duration: Duration;
  /** YYYY-MM-DD, the seed */
  date: string;
  now: number;
  items: Item[];
  attempts: Attempt[];
  reviews: ReviewState[];
  mastery: Map<string, Mastery>;
}

export interface SessionPlan {
  itemIds: string[];
  estSeconds: number;
  budgetSeconds: number;
}

const isQuick = (i: Item) => i.type === 'mcq' || i.type === 'spot-bug';

export function buildSession(input: BuildInput): SessionPlan {
  const { duration, date, now, items, attempts, reviews, mastery } = input;
  const rng = mulberry32(hashString(`${date}:${duration}`));
  const mix = MIX[duration];
  const budget = duration * 60;

  const byId = new Map(items.map((i) => [i.id, i]));
  const picked = new Set<string>();
  const recent = new Set(attempts.filter((a) => now - a.at < RECENT_MS).map((a) => a.itemId));
  const seenTopics = new Set(attempts.flatMap((a) => byId.get(a.itemId)?.topics ?? []));
  const topicValue = (i: Item) => mastery.get(i.topics[0])?.value ?? null;
  const isWeak = (i: Item) => {
    const level = mastery.get(i.topics[0])?.level;
    return level === 'weak' || level === 'learning';
  };
  // stable sort keeps the seeded shuffle order among equal values
  const weakestFirst = (pool: Item[]) =>
    shuffle(pool, rng).sort((a, b) => (topicValue(a) ?? 1) - (topicValue(b) ?? 1));

  const dueIds = new Set(dueItemIds(reviews, now));
  const due = dueItemIds(reviews, now)
    .map((id) => byId.get(id))
    .filter((i): i is Item => i !== undefined && isQuick(i));

  const quickItems = items.filter(isQuick);
  const pools: Record<(typeof BUCKETS)[number][0], Item[]> = {
    due,
    weak: weakestFirst(quickItems.filter(isWeak)),
    unexplored: shuffle(quickItems.filter((i) => !seenTopics.has(i.topics[0])), rng),
    stretch: shuffle(quickItems.filter((i) => i.difficulty === 3 && (topicValue(i) ?? 0) >= 0.5), rng),
  };
  const rest = shuffle(quickItems, rng);

  const available = (i: Item) => !picked.has(i.id) && (dueIds.has(i.id) || !recent.has(i.id));
  const take = (pool: Item[], n: number): Item[] => {
    const out: Item[] = [];
    for (const i of pool) {
      if (out.length >= n) break;
      if (available(i)) {
        picked.add(i.id);
        out.push(i);
      }
    }
    return out;
  };

  // quick questions, bucket by bucket
  const quick: Item[] = [];
  let carry = 0;
  let assigned = 0;
  BUCKETS.forEach(([name, share], index) => {
    const quota = index === BUCKETS.length - 1 ? mix.quick - assigned : Math.round(mix.quick * share);
    assigned += quota;
    const got = take(pools[name], quota + carry);
    quick.push(...got);
    carry = quota + carry - got.length;
  });
  quick.push(...take(rest, carry));

  // open and challenge: weak topic → unexplored topic → anything
  const pickOne = (candidates: Item[]): Item | undefined => {
    const preference = [
      weakestFirst(candidates.filter(isWeak)),
      shuffle(candidates.filter((i) => !seenTopics.has(i.topics[0])), rng),
      shuffle(candidates, rng),
    ];
    for (const pool of preference) {
      const [hit] = take(pool, 1);
      if (hit) return hit;
    }
    return undefined;
  };

  const opens: Item[] = [];
  for (let n = 0; n < mix.open; n++) {
    const hit = pickOne(items.filter((i) => i.type === 'open'));
    if (hit) opens.push(hit);
  }

  const challenges: Item[] = [];
  for (const slot of mix.challenges) {
    const fits = (i: Item) =>
      i.type === 'challenge' &&
      (slot.maxSeconds === undefined || i.estSeconds <= slot.maxSeconds) &&
      (slot.difficulties === undefined || slot.difficulties.includes(i.difficulty));
    const hit = pickOne(items.filter(fits)) ?? pickOne(items.filter((i) => i.type === 'challenge'));
    if (hit) challenges.push(hit);
  }

  // fit the budget: trim quick questions from the lowest-priority end, or top up from the rest
  const total = () => [...quick, ...opens, ...challenges].reduce((s, i) => s + i.estSeconds, 0);
  while (total() > budget * (1 + TOLERANCE) && quick.length > 1) {
    picked.delete(quick.pop()!.id);
  }
  while (total() < budget * (1 - TOLERANCE)) {
    const [extra] = take(rest, 1);
    if (!extra) break;
    quick.push(extra);
  }

  return {
    itemIds: [...quick, ...opens, ...challenges].map((i) => i.id),
    estSeconds: total(),
    budgetSeconds: budget,
  };
}
