import type { Item } from './schema';
import type { TestResult } from './types';

export type Response =
  | { type: 'mcq'; selected: number[] }
  | { type: 'spot-bug'; line: number | null; cause: number | null }
  | { type: 'open'; hitKeyPoints: number[] }
  | { type: 'challenge'; tests: TestResult[]; usedHints: number };

export interface GradeResult {
  /** 0..1 */
  score: number;
  misconceptionIds: string[];
}

export const HINT_PENALTY = 0.1;

type ResponseOf<T extends Response['type']> = Extract<Response, { type: T }>;

export function grade(item: Item, response: Response): GradeResult {
  if (item.type !== response.type) {
    throw new Error(`Response type "${response.type}" does not match item "${item.id}" (${item.type})`);
  }

  switch (item.type) {
    case 'mcq': {
      const { selected } = response as ResponseOf<'mcq'>;
      const picked = new Set(selected);
      const correct = new Set(item.answer);
      const exact = picked.size === correct.size && [...picked].every((i) => correct.has(i));
      const misconceptionIds = [...picked]
        .filter((i) => !correct.has(i))
        .map((i) => item.options[i]?.misconception?.id)
        .filter((m): m is string => m !== undefined);
      return { score: exact ? 1 : 0, misconceptionIds };
    }
    case 'spot-bug': {
      const { line, cause } = response as ResponseOf<'spot-bug'>;
      const lineOk = line === item.answerLine;
      const causeOk = cause === item.answerCause;
      const wrong = !causeOk && cause !== null ? item.causeOptions[cause]?.misconception?.id : undefined;
      return { score: (lineOk ? 0.5 : 0) + (causeOk ? 0.5 : 0), misconceptionIds: wrong ? [wrong] : [] };
    }
    case 'open': {
      const { hitKeyPoints } = response as ResponseOf<'open'>;
      const hits = new Set(hitKeyPoints.filter((i) => i >= 0 && i < item.keyPoints.length));
      return { score: hits.size / item.keyPoints.length, misconceptionIds: [] };
    }
    case 'challenge': {
      const { tests, usedHints } = response as ResponseOf<'challenge'>;
      if (tests.length === 0) return { score: 0, misconceptionIds: [] };
      const ratio = tests.filter((x) => x.pass).length / tests.length;
      return { score: Math.max(0, ratio - HINT_PENALTY * usedHints), misconceptionIds: [] };
    }
  }
}
