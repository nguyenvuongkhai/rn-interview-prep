import { describe, expect, it } from 'vitest';
import { challenge, mcq, open, spotBug } from '../core/testFixtures';
import { EMPTY_DRAFT, toResponse, toggleIn } from './draft';

describe('toResponse', () => {
  it('mcq needs a selection', () => {
    expect(toResponse(mcq('q'), EMPTY_DRAFT)).toBeNull();
    expect(toResponse(mcq('q'), { ...EMPTY_DRAFT, selected: [2] })).toEqual({ type: 'mcq', selected: [2] });
  });

  it('spot-bug needs a line and a cause', () => {
    const q = spotBug('s');
    expect(toResponse(q, { ...EMPTY_DRAFT, line: 2 })).toBeNull();
    expect(toResponse(q, { ...EMPTY_DRAFT, line: 2, cause: 1 })).toEqual({ type: 'spot-bug', line: 2, cause: 1 });
  });

  it('open needs the model answer revealed', () => {
    const q = open('o');
    expect(toResponse(q, { ...EMPTY_DRAFT, hits: [0] })).toBeNull();
    expect(toResponse(q, { ...EMPTY_DRAFT, revealed: true })).toEqual({ type: 'open', hitKeyPoints: [] });
  });

  it('challenge needs a full test run', () => {
    const c = challenge('c');
    expect(toResponse(c, EMPTY_DRAFT)).toBeNull();
    const tests = [{ name: 't', category: 'basic', pass: true, hidden: false }];
    expect(toResponse(c, { ...EMPTY_DRAFT, tests, usedHints: 1 })).toEqual({ type: 'challenge', tests, usedHints: 1 });
  });
});

describe('toggleIn', () => {
  it('adds in order and removes', () => {
    expect(toggleIn([3], 1)).toEqual([1, 3]);
    expect(toggleIn([1, 3], 3)).toEqual([1]);
  });
});
