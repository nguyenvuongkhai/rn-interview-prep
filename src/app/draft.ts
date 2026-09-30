import type { Response } from '../core/grading';
import type { Item } from '../core/schema';
import type { Confidence, TestResult } from '../core/types';

/** What the Test screen holds while the user answers one question. */
export interface Draft {
  selected: number[];
  line: number | null;
  cause: number | null;
  hits: number[];
  revealed: boolean;
  confidence: Confidence | null;
  /** the last full run (hidden tests included); null until the user runs them */
  tests: TestResult[] | null;
  usedHints: number;
}

export const EMPTY_DRAFT: Draft = {
  selected: [], line: null, cause: null, hits: [], revealed: false, confidence: null, tests: null, usedHints: 0,
};

/** The gradable response, or null while the draft is incomplete. */
export function toResponse(item: Item, d: Draft): Response | null {
  switch (item.type) {
    case 'mcq':
      return d.selected.length > 0 ? { type: 'mcq', selected: d.selected } : null;
    case 'spot-bug':
      return d.line !== null && d.cause !== null ? { type: 'spot-bug', line: d.line, cause: d.cause } : null;
    case 'open':
      return d.revealed ? { type: 'open', hitKeyPoints: d.hits } : null;
    case 'challenge':
      return d.tests ? { type: 'challenge', tests: d.tests, usedHints: d.usedHints } : null;
  }
}

export function toggleIn(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort((a, b) => a - b);
}
