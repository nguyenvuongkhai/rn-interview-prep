import type { ChallengeMeta, Item, Mcq, Open, SpotBug, Topic } from './schema';
import type { Attempt } from './types';

const L = (s: string) => ({ vi: s, en: s });

/** 2026-10-01 08:00 UTC */
export const NOW = Date.UTC(2026, 9, 1, 8);

export function mcq(id: string, over: Partial<Mcq> = {}): Mcq {
  return {
    id, type: 'mcq', topics: ['render/memo'], kind: 'core', difficulty: 1, estSeconds: 60, lessons: [],
    prompt: L(id), multi: false, answer: [0], explanation: L('why'),
    options: [
      { text: L('a') },
      { text: L('b'), misconception: { id: 'm-b', text: L('b is wrong') } },
      { text: L('c'), misconception: { id: 'm-c', text: L('c is wrong') } },
    ],
    ...over,
  };
}

export function spotBug(id: string, over: Partial<SpotBug> = {}): SpotBug {
  return {
    id, type: 'spot-bug', topics: ['render/memo'], kind: 'pitfall', difficulty: 2, estSeconds: 90, lessons: [],
    prompt: L(id), code: 'a\nb\nc', answerLine: 2, answerCause: 0, explanation: L('why'),
    causeOptions: [{ text: L('right') }, { text: L('wrong'), misconception: { id: 'm-cause', text: L('x') } }],
    ...over,
  };
}

export function open(id: string, over: Partial<Open> = {}): Open {
  return {
    id, type: 'open', topics: ['render/memo'], kind: 'core', difficulty: 2, estSeconds: 300, lessons: [],
    prompt: L(id), keyPoints: [L('k1'), L('k2'), L('k3'), L('k4')], modelAnswer: L('m'), followUps: [],
    ...over,
  };
}

export function challenge(id: string, over: Partial<ChallengeMeta> = {}): ChallengeMeta {
  return {
    id, type: 'challenge', topics: ['render/memo'], kind: 'core', difficulty: 2, estSeconds: 600, lessons: [],
    title: L(id), hints: [],
    ...over,
  };
}

export function topic(id: string, parent: string | null = null, weight: 1 | 2 | 3 = 2): Topic {
  return { id, title: L(id), parent, weight, group: parent ?? id };
}

let seq = 0;
export function attempt(itemId: string, over: Partial<Attempt> = {}): Attempt {
  seq += 1;
  return {
    id: `a${seq}`, itemId, sessionId: 's1', score: 1, timeSpent: 30, confidence: 'sure',
    usedHints: 0, lang: 'vi', at: NOW, misconceptionIds: [],
    ...over,
  };
}

export const indexById = (items: Item[]) => new Map(items.map((i) => [i.id, i]));
