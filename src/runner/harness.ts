import type { TestResult } from '../core/types';

export interface TestOptions {
  category?: string;
  hidden?: boolean;
}

export interface PlannedTest {
  name: string;
  category: string;
  hidden: boolean;
}

export interface Clock {
  install(): void;
  uninstall(): void;
  tick(ms: number): void;
  tickAsync(ms: number): Promise<void>;
  now(): number;
}

/** Per test, so one never-settling promise cannot stall the rest of the run. */
export const TEST_TIMEOUT_MS = 2000;

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function]';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(right, k) && deepEqual(left[k], right[k]));
}

function fail(message: string): never {
  throw new AssertionError(message);
}

function checkMessage(e: unknown, message: string | undefined): void {
  if (message !== undefined && !errorMessage(e).includes(message)) {
    fail(`Expected an error containing ${describeValue(message)}, got ${describeValue(errorMessage(e))}`);
  }
}

/** The small Jest-like subset challenge tests are written against. */
export function expect(actual: unknown) {
  return {
    toBe(expected: unknown): void {
      if (!Object.is(actual, expected)) fail(`Expected ${describeValue(expected)}, received ${describeValue(actual)}`);
    },
    toEqual(expected: unknown): void {
      if (!deepEqual(actual, expected)) fail(`Expected ${describeValue(expected)}, received ${describeValue(actual)}`);
    },
    toThrow(message?: string): void {
      if (typeof actual !== 'function') fail('toThrow expects a function');
      try {
        (actual as () => unknown)();
      } catch (e) {
        checkMessage(e, message);
        return;
      }
      fail('Expected the function to throw');
    },
    resolves: {
      toBe: async (expected: unknown) => expect(await actual).toBe(expected),
      toEqual: async (expected: unknown) => expect(await actual).toEqual(expected),
    },
    rejects: {
      async toThrow(message?: string): Promise<void> {
        try {
          await actual;
        } catch (e) {
          checkMessage(e, message);
          return;
        }
        fail('Expected the promise to reject');
      },
    },
  };
}

interface FakeTimer {
  id: number;
  at: number;
  every: number | null;
  run: () => void;
}

type TimerFn = (fn: () => void, ms: number) => unknown;
type ClearFn = (id: unknown) => void;

/** Fake setTimeout/setInterval/Date.now on `scope`, opt-in per test with install(). */
export function createClock(scope: typeof globalThis): Clock {
  const original = {
    setTimeout: scope.setTimeout,
    clearTimeout: scope.clearTimeout,
    setInterval: scope.setInterval,
    clearInterval: scope.clearInterval,
    dateNow: Date.now,
  };
  const realSetTimeout = scope.setTimeout.bind(scope) as unknown as TimerFn;
  let installed = false;
  let now = 0;
  let seq = 0;
  let timers: FakeTimer[] = [];

  const add = (fn: unknown, ms: unknown, repeat: boolean, args: unknown[]) => {
    const delay = Math.max(0, Number(ms) || 0);
    const id = ++seq;
    timers.push({
      id,
      at: now + delay,
      every: repeat ? Math.max(1, delay) : null,
      run: () => {
        if (typeof fn === 'function') fn(...args);
      },
    });
    return id;
  };
  const remove = (id: unknown) => {
    timers = timers.filter((t) => t.id !== id);
  };
  const nextDue = (end: number) => timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
  const fire = (t: FakeTimer) => {
    now = t.at;
    if (t.every === null) remove(t.id);
    else t.at += t.every;
    t.run();
  };
  const assertInstalled = () => {
    if (!installed) throw new Error('Call clock.install() before advancing the clock');
  };
  const flush = () => new Promise<void>((resolve) => {
    realSetTimeout(resolve, 0);
  });

  return {
    install() {
      if (installed) return;
      installed = true;
      now = 0;
      timers = [];
      scope.setTimeout = ((fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, false, args)) as unknown as typeof setTimeout;
      scope.clearTimeout = remove as unknown as typeof clearTimeout;
      scope.setInterval = ((fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, true, args)) as unknown as typeof setInterval;
      scope.clearInterval = remove as unknown as typeof clearInterval;
      Date.now = () => now;
    },
    uninstall() {
      if (!installed) return;
      installed = false;
      scope.setTimeout = original.setTimeout;
      scope.clearTimeout = original.clearTimeout;
      scope.setInterval = original.setInterval;
      scope.clearInterval = original.clearInterval;
      Date.now = original.dateNow;
    },
    tick(ms: number) {
      assertInstalled();
      const end = now + ms;
      for (let t = nextDue(end); t; t = nextDue(end)) fire(t);
      now = end;
    },
    async tickAsync(ms: number) {
      assertInstalled();
      const end = now + ms;
      await flush();
      for (let t = nextDue(end); t; t = nextDue(end)) {
        fire(t);
        await flush();
      }
      now = end;
    },
    now: () => now,
  };
}

export function createHarness(scope: typeof globalThis = globalThis) {
  const tests: (PlannedTest & { fn: () => unknown })[] = [];
  const clock = createClock(scope);
  let active: PlannedTest | undefined;
  const realSetTimeout = scope.setTimeout.bind(scope) as unknown as TimerFn;
  const realClearTimeout = scope.clearTimeout.bind(scope) as unknown as ClearFn;

  const withTimeout = (work: Promise<unknown>): Promise<unknown> => {
    let id: unknown;
    const timeout = new Promise((_, reject) => {
      id = realSetTimeout(() => reject(new Error(`Timeout after ${TEST_TIMEOUT_MS} ms`)), TEST_TIMEOUT_MS);
    });
    return Promise.race([work, timeout]).finally(() => realClearTimeout(id));
  };

  return {
    clock,
    expect,
    test(name: string, fn: () => unknown, options: TestOptions = {}): void {
      tests.push({ name, fn, category: options.category ?? 'basic', hidden: options.hidden ?? false });
    },
    /** the test running right now, so callers can tell hidden output apart */
    current: (): PlannedTest | undefined => active,
    planned(include: (t: PlannedTest) => boolean): PlannedTest[] {
      return tests.filter(include).map(({ name, category, hidden }) => ({ name, category, hidden }));
    },
    async run(include: (t: PlannedTest) => boolean, onResult?: (result: TestResult) => void): Promise<TestResult[]> {
      const results: TestResult[] = [];
      for (const t of tests.filter(include)) {
        const base = { name: t.name, category: t.category, hidden: t.hidden };
        let result: TestResult;
        active = base;
        try {
          await withTimeout(Promise.resolve().then(t.fn));
          result = { ...base, pass: true };
        } catch (e) {
          result = { ...base, pass: false, error: errorMessage(e) };
        } finally {
          active = undefined;
          clock.uninstall();
        }
        results.push(result);
        onResult?.(result);
      }
      return results;
    },
  };
}

export type Harness = ReturnType<typeof createHarness>;
