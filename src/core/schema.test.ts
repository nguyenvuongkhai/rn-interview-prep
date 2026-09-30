import { describe, expect, it } from 'vitest';
import { challengeMeta, lessonMeta, question, topic } from './schema';

const L = (s: string) => ({ vi: s, en: s });
const base = { id: 'q-1', topics: ['render/memo'], kind: 'core', difficulty: 2, estSeconds: 60 };

describe('question schema', () => {
  it('accepts a valid mcq and fills defaults', () => {
    const q = question.parse({
      ...base, type: 'mcq', prompt: L('p'), multi: false, answer: [0], explanation: L('e'),
      options: [{ text: L('a') }, { text: L('b'), misconception: { id: 'm-b', text: L('wrong') } }],
    });
    expect(q.lessons).toEqual([]);
  });

  it('rejects text missing a language', () => {
    const r = question.safeParse({
      ...base, type: 'mcq', prompt: { vi: 'p' }, multi: false, answer: [0], explanation: L('e'),
      options: [{ text: L('a') }, { text: L('b') }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects an mcq answer index out of range', () => {
    const r = question.safeParse({
      ...base, type: 'mcq', prompt: L('p'), multi: false, answer: [5], explanation: L('e'),
      options: [{ text: L('a') }, { text: L('b') }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a single-answer mcq with two answers', () => {
    const r = question.safeParse({
      ...base, type: 'mcq', prompt: L('p'), multi: false, answer: [0, 1], explanation: L('e'),
      options: [{ text: L('a') }, { text: L('b') }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a misconception on a correct option', () => {
    const r = question.safeParse({
      ...base, type: 'mcq', prompt: L('p'), multi: false, answer: [0], explanation: L('e'),
      options: [{ text: L('a'), misconception: { id: 'm-a', text: L('x') } }, { text: L('b') }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a spot-bug answerLine past the end of the code', () => {
    const r = question.safeParse({
      ...base, type: 'spot-bug', prompt: L('p'), code: 'a\nb', answerLine: 3,
      causeOptions: [{ text: L('a') }, { text: L('b') }], answerCause: 0, explanation: L('e'),
    });
    expect(r.success).toBe(false);
  });

  it('accepts an open question', () => {
    const q = question.parse({
      ...base, type: 'open', prompt: L('p'), keyPoints: [L('k1'), L('k2')], modelAnswer: L('m'),
    });
    expect(q.type === 'open' && q.followUps).toEqual([]);
  });

  it('rejects a non-kebab id', () => {
    const r = question.safeParse({
      ...base, id: 'Bad Id', type: 'open', prompt: L('p'), keyPoints: [L('k1'), L('k2')], modelAnswer: L('m'),
    });
    expect(r.success).toBe(false);
  });
});

describe('other schemas', () => {
  it('parses a challenge meta with default hints', () => {
    const c = challengeMeta.parse({ ...base, type: 'challenge', title: L('t') });
    expect(c.hints).toEqual([]);
  });

  it('parses a topic with a null parent', () => {
    expect(topic.parse({ id: 'render', title: L('Render'), parent: null, weight: 3, group: 'render' }).parent).toBeNull();
  });

  it('coerces lesson readMinutes from frontmatter text', () => {
    expect(lessonMeta.parse({ id: 'l-1', topic: 'render/memo', kind: 'core', readMinutes: '6' }).readMinutes).toBe(6);
  });
});
