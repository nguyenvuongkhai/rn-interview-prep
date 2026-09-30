import { describe, expect, it } from 'vitest';
import { masteryByTopic } from './mastery';
import { buildSession, type BuildInput, type Duration } from './sessionBuilder';
import { NOW, attempt, challenge, indexById, mcq, open, spotBug, topic } from './testFixtures';
import type { Item } from './schema';
import { DAY_MS } from './types';

const topics = [
  topic('render', null, 3), topic('render/memo', 'render', 3), topic('render/effects', 'render', 3),
  topic('perf', null, 3), topic('perf/lists', 'perf', 3),
];
const leafIds = ['render/memo', 'render/effects', 'perf/lists'];

const bank: Item[] = [
  ...Array.from({ length: 60 }, (_, i) =>
    (i % 3 === 0 ? spotBug : mcq)(`q${i}`, { topics: [leafIds[i % 3]], difficulty: ((i % 3) + 1) as 1 | 2 | 3, estSeconds: 60 }),
  ),
  open('o1', { topics: ['render/memo'] }),
  open('o2', { topics: ['perf/lists'] }),
  challenge('ch-small', { difficulty: 1, estSeconds: 300 }),
  challenge('ch-mid', { difficulty: 2, estSeconds: 600, topics: ['perf/lists'] }),
  challenge('ch-hard', { difficulty: 3, estSeconds: 900 }),
];
const byId = indexById(bank);

function input(over: Partial<BuildInput> = {}): BuildInput {
  const attempts = over.attempts ?? [];
  return {
    duration: 30, date: '2026-10-01', now: NOW, items: bank, attempts, reviews: [],
    mastery: masteryByTopic(topics, attempts, byId, NOW),
    ...over,
  };
}
const typeOf = (id: string) => byId.get(id)!.type;

describe('buildSession', () => {
  it('is deterministic for the same date and duration', () => {
    expect(buildSession(input())).toEqual(buildSession(input()));
  });

  it('varies across dates', () => {
    const orders = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
      .map((date) => buildSession(input({ date })).itemIds.join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it.each([15, 30, 45] as Duration[])('%i minutes lands within ±10%% of the budget with no duplicates', (duration) => {
    const plan = buildSession(input({ duration }));
    expect(plan.budgetSeconds).toBe(duration * 60);
    expect(plan.estSeconds).toBeGreaterThanOrEqual(duration * 60 * 0.9);
    expect(plan.estSeconds).toBeLessThanOrEqual(duration * 60 * 1.1);
    expect(new Set(plan.itemIds).size).toBe(plan.itemIds.length);
  });

  it('matches the mix: 15 → small challenge, 30 → 1 open + 1 mid, 45 → 1 open + mid + hard', () => {
    const kinds = (d: Duration) => buildSession(input({ duration: d })).itemIds.filter((id) => typeOf(id) === 'open' || typeOf(id) === 'challenge');
    expect(kinds(15)).toEqual(['ch-small']);
    expect(kinds(30).filter((id) => typeOf(id) === 'open')).toHaveLength(1);
    expect(kinds(30).filter((id) => typeOf(id) === 'challenge')).toHaveLength(1);
    expect(kinds(45)).toContain('ch-hard');
    expect(kinds(45).filter((id) => typeOf(id) === 'challenge')).toHaveLength(2);
  });

  it('orders quick questions first, then open, then challenges', () => {
    const types = buildSession(input({ duration: 45 })).itemIds.map(typeOf);
    const rank = (t: string) => (t === 'open' ? 1 : t === 'challenge' ? 2 : 0);
    expect(types.map(rank)).toEqual([...types.map(rank)].sort((a, b) => a - b));
  });

  it('puts due reviews first', () => {
    const reviews = [{ itemId: 'q7', box: 0, dueAt: NOW - DAY_MS }, { itemId: 'q4', box: 0, dueAt: NOW - 2 * DAY_MS }];
    expect(buildSession(input({ reviews })).itemIds.slice(0, 2)).toEqual(['q4', 'q7']);
  });

  it('favours the weakest topic', () => {
    const attempts = [
      ...['q1', 'q4', 'q7'].map((id) => attempt(id, { score: 0, at: NOW - 3 * DAY_MS })), // render/effects: weak
      ...['q0', 'q3', 'q6'].map((id) => attempt(id, { score: 1, at: NOW - 3 * DAY_MS })), // render/memo: solid
      ...['q2', 'q5', 'q8'].map((id) => attempt(id, { score: 1, at: NOW - 3 * DAY_MS })), // perf/lists: solid
    ];
    const quick = buildSession(input({ attempts })).itemIds.filter((id) => ['mcq', 'spot-bug'].includes(typeOf(id)));
    const weak = quick.filter((id) => byId.get(id)!.topics[0] === 'render/effects');
    expect(weak.length).toBeGreaterThanOrEqual(4);
  });

  it('skips items attempted in the last 24 hours unless they are due', () => {
    const attempts = bank.slice(0, 50).map((i) => attempt(i.id, { at: NOW - 60_000 }));
    const reviews = [{ itemId: 'q0', box: 0, dueAt: NOW }];
    const ids = buildSession(input({ attempts, reviews })).itemIds;
    expect(ids).toContain('q0');
    const recentNotDue = ids.filter((id) => id !== 'q0' && bank.slice(0, 50).some((i) => i.id === id));
    expect(recentNotDue).toEqual([]);
  });
});
