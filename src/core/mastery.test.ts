import { describe, expect, it } from 'vitest';
import { attemptWeight, effectiveScore, levelOf, masteryByTopic, masteryOf } from './mastery';
import { NOW, attempt, indexById, mcq, topic } from './testFixtures';
import { DAY_MS } from './types';

const q = mcq('q', { estSeconds: 60 });

describe('effectiveScore', () => {
  it('scales by confidence', () => {
    expect(effectiveScore(attempt('q', { confidence: 'sure' }), q)).toBe(1);
    expect(effectiveScore(attempt('q', { confidence: 'fairly' }), q)).toBe(0.85);
    expect(effectiveScore(attempt('q', { confidence: 'guess' }), q)).toBe(0.5);
  });

  it('subtracts 0.1 when slower than twice the estimate, never below 0', () => {
    expect(effectiveScore(attempt('q', { timeSpent: 121 }), q)).toBeCloseTo(0.9);
    expect(effectiveScore(attempt('q', { timeSpent: 120 }), q)).toBe(1);
    expect(effectiveScore(attempt('q', { score: 0, timeSpent: 500 }), q)).toBe(0);
  });
});

describe('attemptWeight', () => {
  it('weights by difficulty and halves every 14 days', () => {
    expect(attemptWeight(attempt('q'), mcq('q', { difficulty: 2 }), NOW)).toBe(1.5);
    expect(attemptWeight(attempt('q', { at: NOW - 14 * DAY_MS }), q, NOW)).toBeCloseTo(0.5);
  });
});

describe('levelOf', () => {
  it('maps value and count to a level', () => {
    expect(levelOf(0.9, 2)).toBe('insufficient');
    expect(levelOf(null, 5)).toBe('insufficient');
    expect(levelOf(0.49, 3)).toBe('weak');
    expect(levelOf(0.5, 3)).toBe('learning');
    expect(levelOf(0.8, 3)).toBe('solid');
  });
});

describe('masteryOf', () => {
  it('is a weighted mean that favours recent attempts', () => {
    const items = indexById([q]);
    const m = masteryOf(
      [attempt('q', { score: 1 }), attempt('q', { score: 1 }), attempt('q', { score: 0, at: NOW - 28 * DAY_MS })],
      items,
      NOW,
    );
    // weights 1, 1, 0.25 → (1 + 1 + 0) / 2.25
    expect(m.value).toBeCloseTo(2 / 2.25);
    expect(m).toMatchObject({ count: 3, level: 'solid' });
  });

  it('ignores attempts for unknown items', () => {
    expect(masteryOf([attempt('missing')], indexById([q]), NOW)).toEqual({ value: null, count: 0, level: 'insufficient' });
  });
});

describe('masteryByTopic', () => {
  it('rolls children up into the parent by weight', () => {
    const topics = [topic('render', null, 3), topic('render/memo', 'render', 3), topic('render/effects', 'render', 1)];
    const items = [mcq('m1'), mcq('e1', { topics: ['render/effects'] })];
    const attempts = [
      ...[1, 2, 3].map(() => attempt('m1', { score: 1 })),
      ...[1, 2, 3].map(() => attempt('e1', { score: 0 })),
    ];
    const m = masteryByTopic(topics, attempts, indexById(items), NOW);
    expect(m.get('render/memo')?.value).toBe(1);
    expect(m.get('render/effects')?.value).toBe(0);
    // (1 × 3 + 0 × 1) / 4
    expect(m.get('render')).toEqual({ value: 0.75, count: 6, level: 'learning' });
  });
});
