import { describe, expect, it } from 'vitest';
import type { Content } from '../content/load';
import { NOW, attempt, mcq, topic } from '../core/testFixtures';
import { DAY_MS } from '../core/types';
import { buildReport, misconceptionText } from './report';

const content: Content = {
  topics: [topic('render'), topic('render/memo', 'render')],
  items: [mcq('q1'), mcq('q2'), mcq('q3'), mcq('q4')],
  lessons: [],
};

describe('buildReport', () => {
  it('summarises the session against earlier history', () => {
    const attempts = [
      ...['q1', 'q2', 'q3'].map((id) => attempt(id, { sessionId: 'old', score: 0, at: NOW - DAY_MS })),
      attempt('q1', { sessionId: 's', score: 1, timeSpent: 40 }),
      attempt('q2', { sessionId: 's', score: 1, confidence: 'guess', timeSpent: 50 }),
      attempt('q4', { sessionId: 's', score: 0, timeSpent: 30, misconceptionIds: ['m-b'] }),
    ];
    const r = buildReport(content, attempts, 's', NOW);
    expect(r).toMatchObject({ correct: 2, total: 3, timeSpentSec: 120, guessedCorrect: 1 });
    expect(r.score).toBeCloseTo(2 / 3);
    expect(r.wrong.map((w) => w.item.id)).toEqual(['q4']);
    expect(r.deltas).toHaveLength(1);
    expect(r.deltas[0]).toMatchObject({ topicId: 'render/memo', before: 0 });
    expect(r.deltas[0].after).toBeGreaterThan(0);
  });

  it('handles a session with no answers', () => {
    expect(buildReport(content, [], 's', NOW)).toMatchObject({ score: 0, correct: 0, total: 0, deltas: [], wrong: [] });
  });
});

describe('misconceptionText', () => {
  it('finds the text of a misconception id, or undefined', () => {
    expect(misconceptionText(content, 'm-b')).toEqual({ vi: 'b is wrong', en: 'b is wrong' });
    expect(misconceptionText(content, 'nope')).toBeUndefined();
  });
});
