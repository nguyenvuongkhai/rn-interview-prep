import { describe, expect, it } from 'vitest';
import { grade } from './grading';
import { challenge, mcq, open, spotBug } from './testFixtures';
import type { TestResult } from './types';

const t = (pass: boolean, category = 'basic'): TestResult => ({ name: 'x', category, pass, hidden: false });

describe('grade', () => {
  it('mcq: exact match scores 1', () => {
    expect(grade(mcq('q'), { type: 'mcq', selected: [0] })).toEqual({ score: 1, misconceptionIds: [] });
  });

  it('mcq multi: a partial selection scores 0', () => {
    const q = mcq('q', { multi: true, answer: [0, 2], options: [{ text: { vi: 'a', en: 'a' } }, { text: { vi: 'b', en: 'b' } }, { text: { vi: 'c', en: 'c' } }] });
    expect(grade(q, { type: 'mcq', selected: [0] }).score).toBe(0);
    expect(grade(q, { type: 'mcq', selected: [2, 0] }).score).toBe(1);
  });

  it('mcq: collects misconceptions of the wrong options picked', () => {
    expect(grade(mcq('q', { multi: true }), { type: 'mcq', selected: [1, 2] }).misconceptionIds).toEqual(['m-b', 'm-c']);
  });

  it('spot-bug: half for the line, half for the cause', () => {
    const q = spotBug('s');
    expect(grade(q, { type: 'spot-bug', line: 2, cause: 0 }).score).toBe(1);
    expect(grade(q, { type: 'spot-bug', line: 2, cause: 1 })).toEqual({ score: 0.5, misconceptionIds: ['m-cause'] });
    expect(grade(q, { type: 'spot-bug', line: 1, cause: 0 }).score).toBe(0.5);
    expect(grade(q, { type: 'spot-bug', line: null, cause: null }).score).toBe(0);
  });

  it('open: fraction of distinct valid key points hit', () => {
    const q = open('o');
    expect(grade(q, { type: 'open', hitKeyPoints: [0, 2] }).score).toBe(0.5);
    expect(grade(q, { type: 'open', hitKeyPoints: [0, 0, 9] }).score).toBe(0.25);
  });

  it('challenge: pass ratio minus 0.1 per hint, floored at 0', () => {
    const c = challenge('c');
    expect(grade(c, { type: 'challenge', tests: [t(true), t(true), t(true), t(false)], usedHints: 0 }).score).toBe(0.75);
    expect(grade(c, { type: 'challenge', tests: [t(true), t(true), t(true), t(false)], usedHints: 2 }).score).toBeCloseTo(0.55);
    expect(grade(c, { type: 'challenge', tests: [t(false)], usedHints: 3 }).score).toBe(0);
    expect(grade(c, { type: 'challenge', tests: [], usedHints: 0 }).score).toBe(0);
  });

  it('throws when the response type does not match the item', () => {
    expect(() => grade(mcq('q'), { type: 'open', hitKeyPoints: [] })).toThrow('does not match');
  });
});
