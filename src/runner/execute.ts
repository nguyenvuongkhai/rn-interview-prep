import { transform } from 'sucrase';
import type { TestResult } from '../core/types';
import { createHarness, describeValue, errorMessage, type PlannedTest } from './harness';

export type Include = 'visible' | 'all';

export interface RunInput {
  solution: string;
  tests: string;
  include: Include;
}

export interface RunOutput {
  results: TestResult[];
  logs: string[];
  /** set when nothing could run: a syntax error, a throw at load time, a timeout */
  error?: string;
}

export interface RunEvents {
  onPlan?: (tests: PlannedTest[]) => void;
  onResult?: (result: TestResult) => void;
  onLog?: (line: string) => void;
}

export const MAX_LOG_LINES = 200;

/** Strips types and turns ES modules into CommonJS so evaluate() can wire `./solution` to the user's code. */
export function compile(ts: string): string {
  return transform(ts, { transforms: ['typescript', 'imports'] }).code;
}

function evaluate(js: string, modules: Record<string, unknown>, scope: Record<string, unknown>): Record<string, unknown> {
  const module = { exports: {} as Record<string, unknown> };
  const require = (name: string) => {
    if (name in modules) return modules[name];
    throw new Error(`Cannot import "${name}" in a challenge`);
  };
  const names = Object.keys(scope);
  // Runs the user's code on purpose. In the app this happens inside a throwaway Web Worker.
  new Function('exports', 'module', 'require', ...names, js)(module.exports, module, require, ...names.map((n) => scope[n]));
  return module.exports;
}

export async function execute(input: RunInput, events: RunEvents = {}): Promise<RunOutput> {
  const logs: string[] = [];
  const log = (...args: unknown[]) => {
    if (logs.length >= MAX_LOG_LINES) return;
    const line = args.map((a) => (typeof a === 'string' ? a : describeValue(a))).join(' ');
    logs.push(line);
    events.onLog?.(line);
  };
  const fakeConsole = { log, info: log, warn: log, error: log, debug: log };

  let solutionJs: string;
  let testsJs: string;
  try {
    solutionJs = compile(input.solution);
    testsJs = compile(input.tests);
  } catch (e) {
    return { results: [], logs, error: `Syntax error: ${errorMessage(e)}` };
  }

  const harness = createHarness();
  try {
    const solution = evaluate(solutionJs, {}, { console: fakeConsole });
    evaluate(testsJs, { './solution': solution }, { console: fakeConsole, test: harness.test, expect: harness.expect, clock: harness.clock });
  } catch (e) {
    harness.clock.uninstall();
    return { results: [], logs, error: errorMessage(e) };
  }

  const include = (t: PlannedTest) => input.include === 'all' || !t.hidden;
  events.onPlan?.(harness.planned(include));
  const results = await harness.run(include, events.onResult);
  return { results, logs };
}
