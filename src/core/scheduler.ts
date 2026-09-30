import { DAY_MS, type Confidence, type ReviewState } from './types';

/** A score at or above this counts as "correct" for scheduling and diagnosis. */
export const PASS_SCORE = 0.8;
/** Days until the next review, indexed by box. */
export const BOX_DAYS = [1, 3, 7, 21, 60] as const;

export function nextReview(
  prev: ReviewState | undefined,
  itemId: string,
  score: number,
  confidence: Confidence,
  now: number,
): ReviewState {
  let box: number;
  if (score < PASS_SCORE) box = 0;
  else if (confidence === 'guess') box = 1;
  else box = prev ? Math.min(prev.box + 1, BOX_DAYS.length - 1) : 1;
  return { itemId, box, dueAt: now + BOX_DAYS[box] * DAY_MS };
}

export function dueItemIds(reviews: ReviewState[], now: number): string[] {
  return reviews
    .filter((r) => r.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.itemId.localeCompare(b.itemId))
    .map((r) => r.itemId);
}
