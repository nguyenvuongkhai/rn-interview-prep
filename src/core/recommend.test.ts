import { describe, expect, it } from 'vitest';
import { masteryByTopic } from './mastery';
import { diagnose, topGaps } from './recommend';
import { NOW, attempt, challenge, indexById, mcq, open, spotBug, topic } from './testFixtures';
import type { TestResult } from './types';

const topics = [topic('render', null, 3), topic('render/memo', 'render', 3), topic('render/effects', 'render', 1)];
const times = <T>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

describe('diagnose', () => {
  it('flags lacks-practice when core is solid but pitfalls are weak', () => {
    const items = [mcq('c1'), spotBug('p1')];
    const attempts = [...times(3, () => attempt('c1')), ...times(2, () => attempt('p1', { score: 0 }))];
    const d = diagnose(topics, attempts, indexById(items), NOW);
    expect(d).toContainEqual({ code: 'lacks-practice', topicId: 'render/memo', core: 1, practice: 0 });
  });

  it('flags cant-explain when mcq is solid but open answers are thin', () => {
    const items = [mcq('m1', { kind: 'advanced' }), open('o1', { kind: 'advanced' })];
    const attempts = [...times(3, () => attempt('m1')), attempt('o1', { score: 0.25 })];
    expect(diagnose(topics, attempts, indexById(items), NOW)).toContainEqual({
      code: 'cant-explain', topicId: 'render/memo', recognise: 1, explain: 0.25,
    });
  });

  it('flags shaky when at least 40% of correct answers were guesses', () => {
    const items = [mcq('m1')];
    const attempts = [attempt('m1', { confidence: 'guess' }), attempt('m1', { confidence: 'guess' }), ...times(3, () => attempt('m1'))];
    expect(diagnose(topics, attempts, indexById(items), NOW)).toContainEqual({ code: 'shaky', topicId: 'render/memo', guessRatio: 0.4 });
  });

  it('flags a challenge test category that failed in two attempts', () => {
    const fail = (category: string): TestResult => ({ name: 'x', category, pass: false, hidden: true });
    const items = [challenge('ch')];
    const attempts = [
      attempt('ch', { score: 0.5, testResults: [fail('edge-case'), fail('edge-case')] }),
      attempt('ch', { score: 0.5, testResults: [fail('edge-case'), fail('async-order')] }),
    ];
    const d = diagnose(topics, attempts, indexById(items), NOW);
    expect(d).toContainEqual({ code: 'challenge-category', category: 'edge-case', failures: 2 });
    expect(d.some((x) => x.code === 'challenge-category' && x.category === 'async-order')).toBe(false);
  });

  it('flags a misconception picked in two attempts', () => {
    const items = [mcq('m1'), mcq('m2')];
    const attempts = [
      attempt('m1', { score: 0, misconceptionIds: ['memo-deep-compare'] }),
      attempt('m2', { score: 0, misconceptionIds: ['memo-deep-compare', 'other'] }),
    ];
    const d = diagnose(topics, attempts, indexById(items), NOW);
    expect(d).toContainEqual({ code: 'misconception', misconceptionId: 'memo-deep-compare', occurrences: 2 });
    expect(d.some((x) => x.code === 'misconception' && x.misconceptionId === 'other')).toBe(false);
  });

  it('reports nothing for parent topics', () => {
    const items = [mcq('c1', { topics: ['render'] }), spotBug('p1', { topics: ['render'] })];
    const attempts = [...times(3, () => attempt('c1')), ...times(2, () => attempt('p1', { score: 0 }))];
    expect(diagnose(topics, attempts, indexById(items), NOW)).toEqual([]);
  });
});

describe('topGaps', () => {
  it('ranks by (1 − mastery) × weight and builds a plan', () => {
    const items = [
      mcq('memo-a'), mcq('memo-b'), mcq('memo-c'), mcq('memo-d'),
      challenge('memo-ch', { estSeconds: 540 }),
      mcq('eff-a', { topics: ['render/effects'] }),
    ];
    const lessons = [{ id: 'memo-lesson', topic: 'render/memo', kind: 'core' as const, readMinutes: 6 }];
    const attempts = [
      ...['memo-a', 'memo-b', 'memo-c'].map((id) => attempt(id, { score: 0 })),
      attempt('memo-a', { score: 1, at: NOW + 1 }),
      ...times(3, () => attempt('eff-a', { score: 0 })),
    ];
    const mastery = masteryByTopic(topics, attempts, indexById(items), NOW);
    const gaps = topGaps({ topics, mastery, items, lessons, attempts });

    // memo: weight 3; effects: weight 1, so memo ranks first
    expect(gaps.map((g) => g.topicId)).toEqual(['render/memo', 'render/effects']);
    expect(gaps[0].plan).toEqual([
      { kind: 'read', lessonId: 'memo-lesson', minutes: 6 },
      // unattempted first, then lowest latest score; memo-a's latest is 1 so it is left out
      { kind: 'practice', itemIds: ['memo-d', 'memo-b', 'memo-c'], minutes: 3 },
      { kind: 'challenge', itemId: 'memo-ch', minutes: 9 },
    ]);
  });

  it('skips topics that are solid or lack data', () => {
    const items = [mcq('m1')];
    const attempts = times(3, () => attempt('m1'));
    const mastery = masteryByTopic(topics, attempts, indexById(items), NOW);
    expect(topGaps({ topics, mastery, items, lessons: [], attempts })).toEqual([]);
  });
});
