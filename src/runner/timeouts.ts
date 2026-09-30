import type { TestResult } from '../core/types';
import type { PlannedTest } from './harness';

/** Whole-run budget in the worker; a synchronous infinite loop is only stopped by terminating it. */
export const RUN_TIMEOUT_MS = 5000;

export function finishTimedOut(planned: PlannedTest[], done: TestResult[]): TestResult[] {
  const seen = new Set(done.map((r) => r.name));
  return [...done, ...planned.filter((p) => !seen.has(p.name)).map((p) => ({ ...p, pass: false, error: 'Timeout' }))];
}
