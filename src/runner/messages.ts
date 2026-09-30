import type { TestResult } from '../core/types';
import type { RunOutput } from './execute';
import type { PlannedTest } from './harness';

export type WorkerMessage =
  | { type: 'plan'; tests: PlannedTest[] }
  | { type: 'result'; result: TestResult }
  | { type: 'log'; line: string }
  | { type: 'done'; output: RunOutput };
