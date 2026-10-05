import { describe, expect, it } from 'vitest';
import type { Mastery } from '../core/mastery';
import { NOW, attempt, mcq, open, topic } from '../core/testFixtures';
import { DAY_MS } from '../core/types';
import { pickInterview, type PickInput } from './pick';

const topics = [topic('render'), topic('render/memo', 'render'), topic('state'), topic('state/async', 'state'), topic('state/redux', 'state')];
const solid: Mastery = { value: 0.9, count: 5, level: 'solid' };

const input = (over: Partial<PickInput> = {}): PickInput => ({
  items: [], topics, attempts: [], mastery: new Map(), scope: { kind: 'weak' }, count: 5, now: NOW, seed: 's', ...over,
});

describe('pickInterview', () => {
  it('only picks open questions, at most count', () => {
    const items = [mcq('q1'), ...Array.from({ length: 6 }, (_, i) => open(`o${i}`))];
    const ids = pickInterview(input({ items, count: 5 }));
    expect(ids).toHaveLength(5);
    expect(ids.every((id) => id.startsWith('o'))).toBe(true);
  });

  it('puts weak topics first, weakest value first, then unseen, then seen', () => {
    const items = [
      open('k1', { topics: ['state'] }), open('u1', { topics: ['state/redux'] }),
      open('m1'), open('a1', { topics: ['state/async'] }), open('m2'), open('a2', { topics: ['state/async'] }),
    ];
    const mastery = new Map<string, Mastery>([
      ['render/memo', { value: 0.4, count: 5, level: 'weak' }],
      ['state/async', { value: 0.2, count: 5, level: 'learning' }],
      ['state', solid],
    ]);
    const attempts = [attempt('k1', { at: NOW - 2 * DAY_MS })];
    const ids = pickInterview(input({ items, mastery, attempts, count: 8 }));
    const topicOf = new Map(items.map((i) => [i.id, i.topics[0]]));
    expect(ids.map((id) => topicOf.get(id))).toEqual([
      'state/async', 'state/async', 'render/memo', 'render/memo', 'state/redux', 'state',
    ]);
  });

  it('puts questions answered in the last day at the end', () => {
    const items = [open('o1'), open('o2'), open('o3')];
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const ids = pickInterview(input({ items, attempts: [attempt('o1', { at: NOW - 1000 })], count: 3, seed }));
      expect(ids[ids.length - 1]).toBe('o1');
    }
  });

  it('keeps to one group', () => {
    const items = [open('r1'), open('a1', { topics: ['state/async'] })];
    expect(pickInterview(input({ items, scope: { kind: 'group', group: 'state' } }))).toEqual(['a1']);
  });

  it('gives the same order for the same seed and another order for another seed', () => {
    const items = Array.from({ length: 8 }, (_, i) => open(`o${i}`));
    const pick = (seed: string) => pickInterview(input({ items, scope: { kind: 'all' }, count: 8, seed }));
    expect(pick('s')).toEqual(pick('s'));
    expect(pick('s')).not.toEqual(pick('t'));
  });
});
