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

  it('challenge has no draft response yet', () => {
    expect(toResponse(challenge('c'), { ...EMPTY_DRAFT, revealed: true, selected: [0] })).toBeNull();
  });
});

describe('toggleIn', () => {
  it('adds in order and removes', () => {
    expect(toggleIn([3], 1)).toEqual([1, 3]);
    expect(toggleIn([1, 3], 3)).toEqual([1]);
  });
});
