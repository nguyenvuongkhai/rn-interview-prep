import { describe, expect, it } from 'vitest';
import { dueItemIds, nextReview } from './scheduler';
import { NOW } from './testFixtures';
import { DAY_MS } from './types';

describe('nextReview', () => {
  it('a wrong answer comes back in 1 day', () => {
    expect(nextReview(undefined, 'q', 0.5, 'sure', NOW)).toEqual({ itemId: 'q', box: 0, dueAt: NOW + DAY_MS });
  });

  it('a correct guess comes back in 3 days', () => {
    expect(nextReview({ itemId: 'q', box: 3, dueAt: 0 }, 'q', 1, 'guess', NOW).dueAt).toBe(NOW + 3 * DAY_MS);
  });

  it('confident correct answers climb 3 → 7 → 21 → 60 and stay at 60', () => {
    let r = nextReview(undefined, 'q', 1, 'sure', NOW);
    const days = [r.dueAt - NOW];
    for (let i = 0; i < 4; i++) {
      r = nextReview(r, 'q', 1, 'fairly', NOW);
      days.push(r.dueAt - NOW);
    }
    expect(days.map((d) => d / DAY_MS)).toEqual([3, 7, 21, 60, 60]);
  });

  it('a wrong answer at any box drops back to 1 day', () => {
    expect(nextReview({ itemId: 'q', box: 4, dueAt: 0 }, 'q', 0, 'sure', NOW).box).toBe(0);
  });

  it('0.8 counts as correct', () => {
    expect(nextReview(undefined, 'q', 0.8, 'sure', NOW).box).toBe(1);
  });
});

describe('dueItemIds', () => {
  it('returns due items, oldest first', () => {
    const reviews = [
      { itemId: 'b', box: 0, dueAt: NOW - 10 },
      { itemId: 'a', box: 0, dueAt: NOW - 20 },
      { itemId: 'c', box: 0, dueAt: NOW + 1 },
      { itemId: 'd', box: 0, dueAt: NOW },
    ];
    expect(dueItemIds(reviews, NOW)).toEqual(['a', 'b', 'd']);
  });
});
