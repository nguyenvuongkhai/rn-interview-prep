# P3 Challenge Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Quy tắc của chủ project:**
> - **Không chạy build/test/dev server.** Mỗi task kết thúc bằng một Checkpoint để Warren chạy.
> - Controller commit và push sau mỗi nhóm task, message 1 dòng `P3: …`.
> - Chỉ Task 0 được chạy `npm install`.

**Goal:** Đưa challenge TypeScript vào bài hằng ngày. Người dùng viết code trong Monaco, chạy test mẫu, chạy toàn bộ test (có test ẩn), rồi nộp và được chấm theo tỉ lệ test pass.

**Architecture:**
- **`src/runner/`**
  - `harness.ts`: `test`/`expect`/`clock` giả, hàm thuần, chạy được cả trong Node lẫn Worker.
  - `execute.ts`: dùng sucrase chuyển TS sang JS, đánh giá solution và tests như module CommonJS nhỏ, rồi chạy harness.
  - `worker.ts` + `runInWorker.ts`: chạy `execute` trong một module Worker dùng một lần, huỷ sau 5 giây.
- **Content:** mỗi challenge là một thư mục gồm `meta.json`, `prompt.{vi,en}.md`, `starter.ts`, `tests.ts`, `solution.ts`. Loader nạp các file này thành `content.challenges[id]`. Test content kiểm tra **solution pass hết test** và **starter fail ít nhất một test**.
- **UI:** `ChallengeView` gồm đề bài dạng Markdown, gợi ý, Monaco (lazy-load), 2 nút chạy test và panel kết quả. Lần chạy toàn bộ gần nhất được lưu vào `Draft`, rồi nộp bằng nút "Nộp câu này" chung với các loại câu khác.

**Tech Stack:** P2 + sucrase 3, @monaco-editor/react 4.7 (Monaco tải từ CDN jsDelivr theo mặc định của loader).

**Tham chiếu:**
- Spec §11
- Mockup màn 3: https://claude.ai/artifact/1fEWFdoWtZgy11ykUj2uXd

**Lưu ý cho người thực thi:**
- Các file `content/challenges/**/*.ts` **không** thuộc `tsconfig` (chỉ include `src`). Chúng được nạp dạng text (`?raw`) và chỉ được sucrase bỏ kiểu, không type-check. Vì vậy `test`/`expect`/`clock` dùng như biến global trong `tests.ts`.
- Các khối Markdown có code fence bên trong được bọc bằng 4 dấu backtick. Nội dung file là phần bên trong.

---

## File structure

```
src/runner/
├── harness.ts (+ harness.test.ts)
├── execute.ts (+ execute.test.ts)
├── timeouts.ts (+ timeouts.test.ts)
├── messages.ts
├── worker.ts
└── runInWorker.ts
src/content/load.ts, index.ts, load.test.ts, content.test.ts   # sửa: challenge files
content/topics.json                                            # thay: thêm 3 topic
content/challenges/debounce/{meta.json,prompt.vi.md,prompt.en.md,starter.ts,tests.ts,solution.ts}
content/challenges/map-limit/{…cùng bộ file}
src/storage/repo.ts, dexieRepo.ts, repo.test.ts                # sửa: drafts
src/app/sessionService.ts (+ test), draft.ts (+ test), report.test.ts   # sửa
src/ui/markdown.ts (+ markdown.test.ts), Markdown.tsx, CodeEditor.tsx, app.css
src/i18n/strings.ts                                            # sửa: chuỗi mới
src/screens/questions/ChallengeView.tsx
src/screens/TestScreen.tsx                                     # thay
src/screens/TodayScreen.tsx, ResultScreen.tsx                  # sửa
```

---

### Task 0: Dependency

- [ ] Branch `P3-0.3.0-P3-RIP-challenge-runner` đã được controller cắt.
- [ ] Cài package:

```bash
cd ~/Downloads/rn-interview-prep && npm install sucrase@^3 @monaco-editor/react@^4.7
```

---

### Task 1: Harness

**Files:** Create `src/runner/harness.ts`, test `src/runner/harness.test.ts`

- [ ] **Step 1: Viết test** `src/runner/harness.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { TEST_TIMEOUT_MS, expect as check, createClock, createHarness, deepEqual } from './harness';

describe('harness expect', () => {
  it('toBe uses Object.is and toEqual compares deeply', () => {
    expect(() => check(Number.NaN).toBe(Number.NaN)).not.toThrow();
    expect(() => check({ a: [1, 2] }).toEqual({ a: [1, 2] })).not.toThrow();
    expect(() => check([1]).toEqual([2])).toThrow('Expected [2], received [1]');
    expect(() => check('1').toBe(1)).toThrow('Expected 1, received "1"');
  });

  it('toThrow checks that a function throws and what it says', () => {
    expect(() => check(() => { throw new Error('boom'); }).toThrow('boo')).not.toThrow();
    expect(() => check(() => undefined).toThrow()).toThrow('Expected the function to throw');
    expect(() => check(() => { throw new Error('x'); }).toThrow('y')).toThrow('Expected an error containing "y", got "x"');
  });

  it('resolves and rejects await the promise', async () => {
    await check(Promise.resolve(2)).resolves.toBe(2);
    await check(Promise.reject(new Error('no'))).rejects.toThrow('no');
    await expect(check(Promise.resolve(1)).rejects.toThrow()).rejects.toThrow('Expected the promise to reject');
  });

  it('deepEqual tells arrays, objects and missing keys apart', () => {
    expect(deepEqual([1], { 0: 1 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: undefined }, {})).toBe(false);
    expect(deepEqual({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } })).toBe(true);
  });
});

describe('fake clock', () => {
  it('tick runs due timers in time order and moves Date.now', () => {
    const clock = createClock(globalThis);
    clock.install();
    try {
      const seen: string[] = [];
      setTimeout(() => seen.push('b'), 20);
      setTimeout(() => seen.push('a'), 10);
      clock.tick(15);
      expect(seen).toEqual(['a']);
      expect(Date.now()).toBe(15);
      clock.tick(5);
      expect(seen).toEqual(['a', 'b']);
    } finally {
      clock.uninstall();
    }
  });

  it('intervals repeat until cleared, and clearTimeout cancels', () => {
    const clock = createClock(globalThis);
    clock.install();
    try {
      let ticks = 0;
      let fired = false;
      const id = setInterval(() => {
        ticks++;
      }, 10);
      clock.tick(35);
      expect(ticks).toBe(3);
      clearInterval(id);
      clock.tick(100);
      expect(ticks).toBe(3);
      const t = setTimeout(() => {
        fired = true;
      }, 5);
      clearTimeout(t);
      clock.tick(10);
      expect(fired).toBe(false);
    } finally {
      clock.uninstall();
    }
  });

  it('uninstall restores the real timers and Date.now', () => {
    const realSetTimeout = globalThis.setTimeout;
    const realNow = Date.now;
    const clock = createClock(globalThis);
    clock.install();
    clock.uninstall();
    expect(globalThis.setTimeout).toBe(realSetTimeout);
    expect(Date.now).toBe(realNow);
  });

  it('tickAsync lets promise chains run between timers', async () => {
    const clock = createClock(globalThis);
    clock.install();
    try {
      const seen: number[] = [];
      const wait = (ms: number) => new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });
      void (async () => {
        await wait(10);
        seen.push(1);
        await wait(10);
        seen.push(2);
      })();
      await clock.tickAsync(20);
      expect(seen).toEqual([1, 2]);
    } finally {
      clock.uninstall();
    }
  });
});

describe('harness run', () => {
  it('reports passes and failures with category defaults', async () => {
    const h = createHarness();
    h.test('ok', () => {});
    h.test('bad', () => h.expect(1).toBe(2), { category: 'edge-case', hidden: true });
    expect(await h.run(() => true)).toEqual([
      { name: 'ok', category: 'basic', hidden: false, pass: true },
      { name: 'bad', category: 'edge-case', hidden: true, pass: false, error: 'Expected 2, received 1' },
    ]);
  });

  it('planned and run respect the filter', async () => {
    const h = createHarness();
    h.test('seen', () => {});
    h.test('secret', () => {}, { hidden: true });
    const visible = (t: { hidden: boolean }) => !t.hidden;
    expect(h.planned(visible)).toEqual([{ name: 'seen', category: 'basic', hidden: false }]);
    expect((await h.run(visible)).map((r) => r.name)).toEqual(['seen']);
  });

  it('uninstalls the clock after each test', async () => {
    const realNow = Date.now;
    const h = createHarness();
    h.test('fakes time', () => {
      h.clock.install();
    });
    await h.run(() => true);
    expect(Date.now).toBe(realNow);
  });

  it('times out a test that never settles', async () => {
    const h = createHarness();
    h.test('hangs', () => new Promise(() => {}));
    const [result] = await h.run(() => true);
    expect(result).toMatchObject({ pass: false, error: `Timeout after ${TEST_TIMEOUT_MS} ms` });
  }, TEST_TIMEOUT_MS + 2000);
});
```

- [ ] **Step 2: Viết `src/runner/harness.ts`**

```ts
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
    planned(include: (t: PlannedTest) => boolean): PlannedTest[] {
      return tests.filter(include).map(({ name, category, hidden }) => ({ name, category, hidden }));
    },
    async run(include: (t: PlannedTest) => boolean, onResult?: (result: TestResult) => void): Promise<TestResult[]> {
      const results: TestResult[] = [];
      for (const t of tests.filter(include)) {
        const base = { name: t.name, category: t.category, hidden: t.hidden };
        let result: TestResult;
        try {
          await withTimeout(Promise.resolve().then(t.fn));
          result = { ...base, pass: true };
        } catch (e) {
          result = { ...base, pass: false, error: errorMessage(e) };
        } finally {
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
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/runner/harness.test.ts`. Kỳ vọng: 12 test pass. Test timeout mất khoảng 2 giây, đó là bình thường.

---

### Task 2: Execute và Worker

**Files:** Create `src/runner/execute.ts`, `src/runner/timeouts.ts`, `src/runner/messages.ts`, `src/runner/worker.ts`, `src/runner/runInWorker.ts`. Test `src/runner/execute.test.ts`, `src/runner/timeouts.test.ts`

- [ ] **Step 1: Viết test** `src/runner/execute.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { execute } from './execute';

const solution = `export function add(a: number, b: number): number {
  console.log('adding', a, b);
  return a + b;
}`;

const tests = `import { add } from './solution';
test('adds', () => { expect(add(1, 2)).toBe(3); });
test('adds hidden', () => { expect(add(2, 2)).toBe(4); }, { category: 'edge-case', hidden: true });
test('fails', () => { expect(add(1, 1)).toBe(3); });`;

describe('execute', () => {
  it('runs only visible tests when asked', async () => {
    const out = await execute({ solution, tests, include: 'visible' });
    expect(out.results.map((r) => [r.name, r.pass])).toEqual([['adds', true], ['fails', false]]);
    expect(out.results[1].error).toBe('Expected 3, received 2');
    expect(out.error).toBeUndefined();
  });

  it('runs hidden tests too with include all', async () => {
    const out = await execute({ solution, tests, include: 'all' });
    expect(out.results.map((r) => [r.name, r.hidden])).toEqual([['adds', false], ['adds hidden', true], ['fails', false]]);
  });

  it('captures console output', async () => {
    const out = await execute({ solution, tests, include: 'visible' });
    expect(out.logs[0]).toBe('adding 1 2');
  });

  it('reports the planned tests before running them', async () => {
    const planned: string[] = [];
    await execute({ solution, tests, include: 'visible' }, { onPlan: (list) => planned.push(...list.map((t) => t.name)) });
    expect(planned).toEqual(['adds', 'fails']);
  });

  it('reports syntax errors without running anything', async () => {
    const out = await execute({ solution: 'export function (', tests, include: 'all' });
    expect(out.error).toMatch(/^Syntax error/);
    expect(out.results).toEqual([]);
  });

  it('only lets tests import the solution', async () => {
    const out = await execute({ solution, tests: `import fs from 'fs';\ntest('t', () => {});`, include: 'all' });
    expect(out.error).toContain('Cannot import "fs"');
  });
});
```

- [ ] **Step 2: Viết `src/runner/execute.ts`**

```ts
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
```

- [ ] **Step 3: Viết test** `src/runner/timeouts.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { finishTimedOut } from './timeouts';

describe('finishTimedOut', () => {
  it('marks planned tests that never reported as timed out', () => {
    const planned = [
      { name: 'a', category: 'basic', hidden: false },
      { name: 'b', category: 'edge-case', hidden: true },
    ];
    expect(finishTimedOut(planned, [{ name: 'a', category: 'basic', hidden: false, pass: true }])).toEqual([
      { name: 'a', category: 'basic', hidden: false, pass: true },
      { name: 'b', category: 'edge-case', hidden: true, pass: false, error: 'Timeout' },
    ]);
  });
});
```

- [ ] **Step 4: Viết `src/runner/timeouts.ts`**

```ts
import type { TestResult } from '../core/types';
import type { PlannedTest } from './harness';

/** Whole-run budget in the worker; a synchronous infinite loop is only stopped by terminating it. */
export const RUN_TIMEOUT_MS = 5000;

export function finishTimedOut(planned: PlannedTest[], done: TestResult[]): TestResult[] {
  const seen = new Set(done.map((r) => r.name));
  return [...done, ...planned.filter((p) => !seen.has(p.name)).map((p) => ({ ...p, pass: false, error: 'Timeout' }))];
}
```

- [ ] **Step 5: Viết `src/runner/messages.ts`**

```ts
import type { TestResult } from '../core/types';
import type { RunOutput } from './execute';
import type { PlannedTest } from './harness';

export type WorkerMessage =
  | { type: 'plan'; tests: PlannedTest[] }
  | { type: 'result'; result: TestResult }
  | { type: 'log'; line: string }
  | { type: 'done'; output: RunOutput };
```

- [ ] **Step 6: Viết `src/runner/worker.ts`**

```ts
import { execute, type RunInput } from './execute';
import type { WorkerMessage } from './messages';

const post = (message: WorkerMessage) => self.postMessage(message);

self.onmessage = (event: MessageEvent<RunInput>) => {
  void execute(event.data, {
    onPlan: (tests) => post({ type: 'plan', tests }),
    onResult: (result) => post({ type: 'result', result }),
    onLog: (line) => post({ type: 'log', line }),
  }).then((output) => post({ type: 'done', output }));
};
```

- [ ] **Step 7: Viết `src/runner/runInWorker.ts`**

```ts
import type { TestResult } from '../core/types';
import type { RunInput, RunOutput } from './execute';
import type { PlannedTest } from './harness';
import type { WorkerMessage } from './messages';
import { RUN_TIMEOUT_MS, finishTimedOut } from './timeouts';

/** Runs in a throwaway module worker so a hung or hostile solution cannot freeze the page. */
export function runInWorker(input: RunInput): Promise<RunOutput> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const planned: PlannedTest[] = [];
    const results: TestResult[] = [];
    const logs: string[] = [];
    const end = (output: RunOutput) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve(output);
    };
    const timer = window.setTimeout(
      () => end({ results: finishTimedOut(planned, results), logs, error: `Timeout after ${RUN_TIMEOUT_MS} ms` }),
      RUN_TIMEOUT_MS,
    );
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const m = event.data;
      if (m.type === 'plan') planned.push(...m.tests);
      else if (m.type === 'result') results.push(m.result);
      else if (m.type === 'log') logs.push(m.line);
      else end(m.output);
    };
    worker.onerror = (event) => end({ results: [], logs, error: event.message || 'The test runner failed to start' });
    worker.postMessage(input);
  });
}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/runner`. Kỳ vọng: tổng 19 test pass (12 harness + 6 execute + 1 timeouts).

---

### Task 3: Nội dung challenge

**Files:** Modify `src/content/load.ts`, `src/content/index.ts`, `src/content/load.test.ts`, `src/content/content.test.ts`, `src/app/sessionService.test.ts`, `src/app/report.test.ts`. Replace `content/topics.json`. Create 12 file challenge.

- [ ] **Step 1: Sửa `src/content/load.ts`**
  - (a) Thay interface `RawContent` và `Content`, rồi thêm `ChallengeFiles` ngay sau `Content`:

```ts
export interface RawContent {
  topics: unknown;
  /** path → parsed JSON array */
  questionFiles: Record<string, unknown>;
  /** path → parsed meta.json */
  challengeFiles: Record<string, unknown>;
  /** path → raw text of every other file in a challenge folder */
  challengeTexts: Record<string, string>;
  /** path → raw markdown */
  lessonFiles: Record<string, string>;
}

export interface Content {
  topics: Topic[];
  items: Item[];
  lessons: Lesson[];
  challenges: Record<string, ChallengeFiles>;
}

export interface ChallengeFiles {
  prompt: Localized;
  starter: string;
  tests: string;
  solution: string;
}
```

  - (b) Trong khối import từ `'../core/schema'`, thêm `type Localized,` (ví dụ ngay sau `type LessonMeta,`).
  - (c) Thay vòng lặp `for (const [path, value] of byPath(raw.challengeFiles)) { … }` bằng:

```ts
  const challenges: Record<string, ChallengeFiles> = {};
  for (const [path, value] of byPath(raw.challengeFiles)) {
    const meta = parse(challengeMeta, value, path);
    if (!meta) continue;
    items.push(meta);
    const folder = /\/challenges\/([^/]+)\/meta\.json$/.exec(path)?.[1];
    if (folder !== meta.id) {
      issues.push(`${path}: id "${meta.id}" must match its folder "${folder ?? '?'}"`);
      continue;
    }
    const dir = path.slice(0, -'meta.json'.length);
    const file = (name: string) => {
      const text = raw.challengeTexts[dir + name];
      if (text === undefined) issues.push(`challenge "${meta.id}": missing ${name}`);
      return text ?? '';
    };
    challenges[meta.id] = {
      prompt: { vi: file('prompt.vi.md'), en: file('prompt.en.md') },
      starter: file('starter.ts'),
      tests: file('tests.ts'),
      solution: file('solution.ts'),
    };
  }
```

  - (d) Đổi dòng return cuối cùng thành `return { topics, items, lessons, challenges };`

- [ ] **Step 2: Sửa `src/content/index.ts`**: thêm glob sau `challengeFiles`, rồi truyền vào `loadContent`:

```ts
const challengeTexts = import.meta.glob<string>('/content/challenges/*/*.{md,ts}', {
  eager: true,
  query: '?raw',
  import: 'default',
});
```

và trong object truyền cho `loadContent`, thêm `challengeTexts,` ngay sau `challengeFiles,`.

- [ ] **Step 3: Sửa `src/content/load.test.ts`**
  - Trong `function raw(…)`, thêm `challengeTexts: {},` ngay sau `challengeFiles: {},`.
  - Thêm vào cuối `describe('loadContent', …)`:

```ts
  const meta = (id: string) => ({
    id, type: 'challenge', topics: ['render/memo'], kind: 'core', difficulty: 1, estSeconds: 300, title: L('t'),
  });
  const texts = (dir: string) =>
    Object.fromEntries(['prompt.vi.md', 'prompt.en.md', 'starter.ts', 'tests.ts', 'solution.ts'].map((f) => [`${dir}${f}`, f]));

  it('loads a challenge with its files', () => {
    const c = loadContent(raw({
      challengeFiles: { '/content/challenges/deb/meta.json': meta('deb') },
      challengeTexts: texts('/content/challenges/deb/'),
    }));
    expect(c.challenges.deb).toEqual({
      prompt: { vi: 'prompt.vi.md', en: 'prompt.en.md' }, starter: 'starter.ts', tests: 'tests.ts', solution: 'solution.ts',
    });
    expect(c.items.map((i) => i.id)).toContain('deb');
  });

  it('reports a missing challenge file', () => {
    const t = texts('/content/challenges/deb/');
    delete t['/content/challenges/deb/tests.ts'];
    const issues = issuesOf(raw({ challengeFiles: { '/content/challenges/deb/meta.json': meta('deb') }, challengeTexts: t }));
    expect(issues).toContain('challenge "deb": missing tests.ts');
  });

  it('reports a challenge id that does not match its folder', () => {
    const issues = issuesOf(raw({
      challengeFiles: { '/content/challenges/other/meta.json': meta('deb') },
      challengeTexts: texts('/content/challenges/other/'),
    }));
    expect(issues).toContain('/content/challenges/other/meta.json: id "deb" must match its folder "other"');
  });
```

- [ ] **Step 4: Sửa các test đang tạo `Content` bằng tay.** Trong `src/app/sessionService.test.ts` và `src/app/report.test.ts`, thêm `challenges: {},` ngay sau dòng `lessons: [],` của hằng `content`.

- [ ] **Step 5: Sửa `src/content/content.test.ts`**: thêm `import { execute } from '../runner/execute';` sau dòng import hiện có, rồi thêm vào cuối `describe`:

```ts
  it('every challenge solution passes all of its tests', async () => {
    expect(Object.keys(content.challenges).length).toBeGreaterThan(0);
    for (const [id, files] of Object.entries(content.challenges)) {
      const out = await execute({ solution: files.solution, tests: files.tests, include: 'all' });
      expect(out.error, id).toBeUndefined();
      expect(out.results.length, id).toBeGreaterThan(0);
      expect(out.results.filter((r) => !r.pass), id).toEqual([]);
    }
  });

  it('every challenge starter fails at least one test', async () => {
    for (const [id, files] of Object.entries(content.challenges)) {
      const out = await execute({ solution: files.starter, tests: files.tests, include: 'all' });
      expect(out.results.some((r) => !r.pass), id).toBe(true);
    }
  });
```

- [ ] **Step 6: Thay `content/topics.json`**

```json
[
  { "id": "render", "title": { "vi": "Render & reconciliation", "en": "Rendering & reconciliation" }, "parent": null, "weight": 3, "group": "render" },
  { "id": "render/memo", "title": { "vi": "memo, useCallback, useMemo", "en": "memo, useCallback, useMemo" }, "parent": "render", "weight": 3, "group": "render" },
  { "id": "render/effects", "title": { "vi": "useEffect và vòng đời", "en": "useEffect and lifecycle" }, "parent": "render", "weight": 3, "group": "render" },
  { "id": "architecture", "title": { "vi": "Kiến trúc React Native", "en": "React Native architecture" }, "parent": null, "weight": 3, "group": "architecture" },
  { "id": "architecture/new-arch", "title": { "vi": "Kiến trúc mới: JSI, Fabric, TurboModules", "en": "New Architecture: JSI, Fabric, TurboModules" }, "parent": "architecture", "weight": 3, "group": "architecture" },
  { "id": "performance", "title": { "vi": "Hiệu năng", "en": "Performance" }, "parent": null, "weight": 3, "group": "performance" },
  { "id": "performance/lists", "title": { "vi": "FlatList và danh sách dài", "en": "FlatList and long lists" }, "parent": "performance", "weight": 3, "group": "performance" },
  { "id": "performance/js-thread", "title": { "vi": "JS thread và tần suất sự kiện", "en": "The JS thread and event frequency" }, "parent": "performance", "weight": 2, "group": "performance" },
  { "id": "state", "title": { "vi": "State và dữ liệu", "en": "State and data" }, "parent": null, "weight": 3, "group": "state" },
  { "id": "state/async", "title": { "vi": "Bất đồng bộ và race condition", "en": "Async work and race conditions" }, "parent": "state", "weight": 3, "group": "state" }
]
```

- [ ] **Step 7: Challenge `debounce`**

`content/challenges/debounce/meta.json`:
```json
{
  "id": "debounce",
  "type": "challenge",
  "topics": ["performance/js-thread"],
  "kind": "core",
  "difficulty": 1,
  "estSeconds": 300,
  "title": { "vi": "Tự viết debounce", "en": "Write debounce" },
  "hints": [
    { "vi": "Giữ id của timer ở ngoài hàm trả về. Mỗi lần gọi thì `clearTimeout` timer cũ rồi đặt timer mới.", "en": "Keep the timer id outside the returned function. On each call, `clearTimeout` the old timer and set a new one." },
    { "vi": "`cancel` chỉ cần xoá timer đang chờ và quên id của nó.", "en": "`cancel` only needs to clear the pending timer and forget its id." }
  ]
}
```

`content/challenges/debounce/prompt.vi.md`:
````markdown
## Đề bài
Viết `debounce(fn, wait)`. Hàm trả về chỉ gọi `fn` khi đã yên lặng đủ `wait` ms kể từ lần gọi cuối, với đúng tham số của lần gọi cuối đó.

Hàm trả về có thêm `cancel()` để huỷ lần gọi đang chờ.

## Vì sao hay bị hỏi
Ô tìm kiếm gọi API theo từng phím gõ sẽ spam request và giữ JS thread bận. Interviewer thường hỏi tiếp: gọi `cancel` ở đâu khi component unmount?

## Ví dụ
```ts
const search = debounce((q: string) => api.search(q), 300);
search('r');
search('re');
search('rea'); // chỉ gọi api.search('rea'), sau 300 ms
```

## Quy ước
- `wait` bằng 0 vẫn phải chờ tới timer kế tiếp, không gọi ngay.
- Test dùng đồng hồ giả, nên chỉ dùng `setTimeout` và `clearTimeout`.
````

`content/challenges/debounce/prompt.en.md`:
````markdown
## Task
Write `debounce(fn, wait)`. The returned function calls `fn` only after `wait` ms of quiet since the last call, with that last call's arguments.

The returned function also has `cancel()`, which drops the pending call.

## Why interviewers ask
A search box that calls the API on every keystroke floods the network and keeps the JS thread busy. The usual follow-up: where do you call `cancel` when the component unmounts?

## Example
```ts
const search = debounce((q: string) => api.search(q), 300);
search('r');
search('re');
search('rea'); // calls api.search('rea') once, after 300 ms
```

## Rules
- A `wait` of 0 still waits for the next timer; it does not call immediately.
- Tests use a fake clock, so use only `setTimeout` and `clearTimeout`.
````

`content/challenges/debounce/starter.ts`:
```ts
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): ((...args: A) => void) & { cancel: () => void } {
  // TODO: call fn once `wait` ms have passed since the last call
  throw new Error('Not implemented');
}
```

`content/challenges/debounce/tests.ts`:
```ts
import { debounce } from './solution';

test('calls once after the wait, with the last arguments', () => {
  clock.install();
  const calls: number[] = [];
  const d = debounce((n: number) => {
    calls.push(n);
  }, 100);
  d(1);
  d(2);
  clock.tick(99);
  expect(calls).toEqual([]);
  d(3);
  clock.tick(100);
  expect(calls).toEqual([3]);
}, { category: 'basic' });

test('each quiet period fires on its own', () => {
  clock.install();
  const calls: number[] = [];
  const d = debounce((n: number) => {
    calls.push(n);
  }, 50);
  d(1);
  clock.tick(50);
  d(2);
  clock.tick(50);
  expect(calls).toEqual([1, 2]);
}, { category: 'basic' });

test('cancel drops the pending call', () => {
  clock.install();
  const calls: number[] = [];
  const d = debounce((n: number) => {
    calls.push(n);
  }, 100);
  d(1);
  d.cancel();
  clock.tick(200);
  expect(calls).toEqual([]);
  d(2);
  clock.tick(100);
  expect(calls).toEqual([2]);
}, { category: 'edge-case', hidden: true });

test('a wait of 0 still waits for the next timer', () => {
  clock.install();
  const calls: number[] = [];
  const d = debounce((n: number) => {
    calls.push(n);
  }, 0);
  d(1);
  expect(calls).toEqual([]);
  clock.tick(0);
  expect(calls).toEqual([1]);
}, { category: 'edge-case', hidden: true });
```

`content/challenges/debounce/solution.ts`:
```ts
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
```

- [ ] **Step 8: Challenge `map-limit`**

`content/challenges/map-limit/meta.json`:
```json
{
  "id": "map-limit",
  "type": "challenge",
  "topics": ["state/async"],
  "kind": "core",
  "difficulty": 2,
  "estSeconds": 600,
  "title": { "vi": "Giới hạn số request chạy cùng lúc", "en": "Limit concurrent requests" },
  "hints": [
    { "vi": "Tạo đúng `limit` worker. Mỗi worker lấy index kế tiếp từ một biến đếm dùng chung cho tới khi hết phần tử.", "en": "Start exactly `limit` workers. Each takes the next index from a shared counter until the items run out." },
    { "vi": "Ghi kết quả vào `results[i]` theo index gốc, rồi `await Promise.all` các worker.", "en": "Write each result to `results[i]` by its original index, then `await Promise.all` the workers." }
  ]
}
```

`content/challenges/map-limit/prompt.vi.md`:
````markdown
## Đề bài
Viết `mapLimit(items, limit, fn)`: gọi `fn` cho từng phần tử, không bao giờ có quá `limit` lời gọi đang chạy cùng lúc, và trả về kết quả đúng thứ tự đầu vào.

Một slot vừa rảnh thì phải bắt đầu phần tử kế tiếp ngay, không đợi cả nhóm xong.

## Tình huống thật
Upload 40 ảnh từ camera roll nhưng chỉ cho 3 request song song, để không nghẽn mạng di động và không bị server từ chối.

## Ví dụ
```ts
const urls = await mapLimit(photos, 3, (photo) => upload(photo));
// urls[i] là kết quả của photos[i]
```

## Quy ước
- Mảng rỗng trả về `[]` và không gọi `fn`.
- Nếu `fn` reject thì `mapLimit` cũng reject với lỗi đó.
````

`content/challenges/map-limit/prompt.en.md`:
````markdown
## Task
Write `mapLimit(items, limit, fn)`: call `fn` for every item, never with more than `limit` calls in flight, and return the results in input order.

As soon as a slot frees up, start the next item; do not wait for a whole batch.

## Real case
Upload 40 photos from the camera roll with at most 3 requests in parallel, so the mobile network does not choke and the server does not throttle you.

## Example
```ts
const urls = await mapLimit(photos, 3, (photo) => upload(photo));
// urls[i] is the result for photos[i]
```

## Rules
- An empty list resolves to `[]` without calling `fn`.
- If `fn` rejects, `mapLimit` rejects with that error.
````

`content/challenges/map-limit/starter.ts`:
```ts
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  // TODO: never run more than `limit` calls of fn at once
  throw new Error('Not implemented');
}
```

`content/challenges/map-limit/tests.ts`:
```ts
import { mapLimit } from './solution';

const tick = () => Promise.resolve();

test('keeps results in input order', async () => {
  const result = await mapLimit([3, 1, 2], 2, async (n: number) => {
    for (let i = 0; i < n; i++) await tick();
    return n * 10;
  });
  expect(result).toEqual([30, 10, 20]);
}, { category: 'basic' });

test('never runs more than limit at once', async () => {
  let active = 0;
  let peak = 0;
  await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n: number) => {
    active++;
    peak = Math.max(peak, active);
    await tick();
    await tick();
    active--;
    return n;
  });
  expect(peak).toBe(2);
}, { category: 'async-order' });

test('an empty list resolves to an empty array', async () => {
  let calls = 0;
  const result = await mapLimit([], 3, async () => {
    calls++;
    return 1;
  });
  expect(result).toEqual([]);
  expect(calls).toBe(0);
}, { category: 'edge-case', hidden: true });

test('a limit above the list length still runs everything', async () => {
  const result = await mapLimit(['a', 'b'], 10, async (s: string) => s.toUpperCase());
  expect(result).toEqual(['A', 'B']);
}, { category: 'edge-case', hidden: true });

test('rejects when fn rejects', async () => {
  await expect(mapLimit([1, 2], 1, async (n: number) => {
    if (n === 2) throw new Error('upload failed');
    return n;
  })).rejects.toThrow('upload failed');
}, { category: 'edge-case', hidden: true });

test('starts the next item as soon as a slot frees up', async () => {
  const started: number[] = [];
  const gates: Array<() => void> = [];
  const run = mapLimit([1, 2, 3], 2, (n: number) => new Promise<number>((resolve) => {
    started.push(n);
    gates.push(() => resolve(n));
  }));
  await tick();
  expect(started).toEqual([1, 2]);
  gates[0]();
  await tick();
  await tick();
  expect(started).toEqual([1, 2, 3]);
  gates[1]();
  gates[2]();
  expect(await run).toEqual([1, 2, 3]);
}, { category: 'async-order', hidden: true });
```

`content/challenges/map-limit/solution.ts`:
```ts
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/content`. Kỳ vọng: 19 test pass (5 frontmatter, 10 load, 4 content). 2 test mới của content chạy solution và starter của cả 2 challenge.

---

### Task 4: Lưu code nháp và đưa challenge vào bài

**Files:** Modify `src/storage/repo.ts`, `src/storage/dexieRepo.ts`, `src/storage/repo.test.ts`, `src/app/sessionService.ts`, `src/app/sessionService.test.ts`, `src/app/draft.ts`, `src/app/draft.test.ts`

- [ ] **Step 1: `src/storage/repo.ts`**
  - Thêm vào interface `Repo`, trước `getSetting`:

```ts
  getDraft(challengeId: string): Promise<string | undefined>;
  putDraft(challengeId: string, code: string): Promise<void>;
```

  - Trong `createMemoryRepo`: thêm `const drafts = new Map<string, string>();` sau dòng `const settings = …`, và thêm 2 method trước `async getSetting`:

```ts
    async getDraft(challengeId) {
      return drafts.get(challengeId);
    },
    async putDraft(challengeId, code) {
      drafts.set(challengeId, code);
    },
```

- [ ] **Step 2: `src/storage/dexieRepo.ts`**
  - Trong kiểu `AppDb`, thêm `drafts: Table<{ challengeId: string; code: string; updatedAt: number }, string>;`
  - Trong `createDb`, ngay sau khối `db.version(1).stores({…});`, thêm:

```ts
  db.version(2).stores({ drafts: 'challengeId' });
```

  - Trong `createDexieRepo`, thêm trước `getSetting`:

```ts
    getDraft: async (challengeId) => (await db.drafts.get(challengeId))?.code,
    putDraft: async (challengeId, code) => {
      await db.drafts.put({ challengeId, code, updatedAt: Date.now() });
    },
```

- [ ] **Step 3: `src/storage/repo.test.ts`**: thêm vào cuối `describe.each(…)`:

```ts
  it('keeps one code draft per challenge', async () => {
    const repo = make();
    expect(await repo.getDraft('deb')).toBeUndefined();
    await repo.putDraft('deb', 'a');
    await repo.putDraft('deb', 'b');
    expect(await repo.getDraft('deb')).toBe('b');
  });
```

- [ ] **Step 4: `src/app/sessionService.ts`**
  - Xoá 2 dòng:
    ```ts
      // Challenges need the code runner, which arrives in P3.
      const quizItems = content.items.filter((i) => i.type !== 'challenge');
    ```
  - Trong `plan(…)`, đổi `items: quizItems` thành `items: content.items`.
  - Thêm vào object trả về, ngay sau `listAttempts: () => repo.listAttempts(),`:

```ts
    loadDraft: (challengeId: string) => repo.getDraft(challengeId),
    saveDraft: (challengeId: string, code: string) => repo.putDraft(challengeId, code),
```

- [ ] **Step 5: `src/app/sessionService.test.ts`**: thay toàn bộ test `it('leaves challenges out until the runner exists', …)` bằng:

```ts
  it('includes challenges in the plan', async () => {
    const { service } = setup();
    expect((await service.start(45, NOW)).itemIds).toContain('ch1');
  });

  it('keeps challenge code drafts', async () => {
    const { service } = setup();
    await service.saveDraft('ch1', 'export {}');
    expect(await service.loadDraft('ch1')).toBe('export {}');
  });
```

- [ ] **Step 6: `src/app/draft.ts`**
  - Đổi `import type { Confidence } from '../core/types';` thành `import type { Confidence, TestResult } from '../core/types';`
  - Thêm 2 field vào cuối interface `Draft`:

```ts
  /** the last full run (hidden tests included); null until the user runs them */
  tests: TestResult[] | null;
  usedHints: number;
```

  - Đổi `EMPTY_DRAFT` thành:

```ts
export const EMPTY_DRAFT: Draft = {
  selected: [], line: null, cause: null, hits: [], revealed: false, confidence: null, tests: null, usedHints: 0,
};
```

  - Đổi nhánh `case 'challenge': return null;` thành:

```ts
    case 'challenge':
      return d.tests ? { type: 'challenge', tests: d.tests, usedHints: d.usedHints } : null;
```

- [ ] **Step 7: `src/app/draft.test.ts`**: thay test `it('challenge has no draft response yet', …)` bằng:

```ts
  it('challenge needs a full test run', () => {
    const c = challenge('c');
    expect(toResponse(c, EMPTY_DRAFT)).toBeNull();
    const tests = [{ name: 't', category: 'basic', pass: true, hidden: false }];
    expect(toResponse(c, { ...EMPTY_DRAFT, tests, usedHints: 1 })).toEqual({ type: 'challenge', tests, usedHints: 1 });
  });
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/storage src/app`. Kỳ vọng: storage 10, sessionService 11, draft 5, report 3, router 3 đều pass.

---

### Task 5: Markdown, editor, chuỗi và CSS

**Files:** Create `src/ui/markdown.ts`, `src/ui/markdown.test.ts`, `src/ui/Markdown.tsx`, `src/ui/CodeEditor.tsx`. Modify `src/i18n/strings.ts`, `src/ui/app.css`

- [ ] **Step 1: Viết test** `src/ui/markdown.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reads headings and joins paragraph lines', () => {
    expect(parseMarkdown('## Title\nline one\nline two\n\nnext')).toEqual([
      { kind: 'heading', level: 2, text: 'Title' },
      { kind: 'paragraph', text: 'line one line two' },
      { kind: 'paragraph', text: 'next' },
    ]);
  });

  it('reads bullet lists', () => {
    expect(parseMarkdown('- a\n* b\n\nafter')).toEqual([
      { kind: 'list', items: ['a', 'b'] },
      { kind: 'paragraph', text: 'after' },
    ]);
  });

  it('keeps code fences verbatim', () => {
    expect(parseMarkdown('```ts\nconst a = 1;\n\n  b();\n```\ntext')).toEqual([
      { kind: 'code', lang: 'ts', text: 'const a = 1;\n\n  b();' },
      { kind: 'paragraph', text: 'text' },
    ]);
  });

  it('runs an unclosed fence to the end', () => {
    expect(parseMarkdown('```\nx')).toEqual([{ kind: 'code', lang: '', text: 'x' }]);
  });
});
```

- [ ] **Step 2: Viết `src/ui/markdown.ts`**

```ts
export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

const FENCE = /^```(\w*)\s*$/;
const FENCE_END = /^```\s*$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^[-*]\s+/;
const BLOCK_START = /^(```|#{1,3}\s|[-*]\s)/;

/** The subset challenge prompts and lessons use: headings, paragraphs, bullet lists, code fences. Inline `code` is left to <Rich>. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE_END.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ kind: 'code', lang: fence[1], text: body.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      i++;
      continue;
    }
    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) items.push(lines[i++].replace(BULLET, '').trim());
      blocks.push({ kind: 'list', items });
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) paragraph.push(lines[i++].trim());
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}
```

- [ ] **Step 3: Viết `src/ui/Markdown.tsx`**

```tsx
import { Rich } from './components';
import { parseMarkdown } from './markdown';

export function Markdown({ source }: { source: string }) {
  return (
    <div className="md">
      {parseMarkdown(source).map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return block.level === 1 ? <h3 key={i}><Rich text={block.text} /></h3> : <h4 key={i}><Rich text={block.text} /></h4>;
          case 'code':
            return <pre key={i} className="md-code">{block.text}</pre>;
          case 'list':
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}><Rich text={item} /></li>
                ))}
              </ul>
            );
          case 'paragraph':
            return <p key={i}><Rich text={block.text} /></p>;
        }
      })}
    </div>
  );
}
```

- [ ] **Step 4: Viết `src/ui/CodeEditor.tsx`** (default export để `React.lazy` tách Monaco ra chunk riêng)

```tsx
import Editor, { type BeforeMount } from '@monaco-editor/react';

const definePine: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('pine', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#121715',
      'editor.lineHighlightBackground': '#1a211e',
      'editorLineNumber.foreground': '#95a39d',
    },
  });
};

export default function CodeEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Editor
      height="420px"
      path="solution.ts"
      defaultLanguage="typescript"
      theme="pine"
      value={value}
      beforeMount={definePine}
      onChange={(next) => onChange(next ?? '')}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
```

- [ ] **Step 5: `src/i18n/strings.ts`**: thêm các key sau vào object `UI`, ngay trước `} satisfies Record<string, Localized>;`:

```ts
  countChallenge: { vi: 'challenge TypeScript', en: 'TypeScript challenges' },
  runVisible: { vi: 'Chạy test mẫu', en: 'Run sample tests' },
  runAll: { vi: 'Chạy toàn bộ test', en: 'Run all tests' },
  running: { vi: 'Đang chạy…', en: 'Running…' },
  runFirst: { vi: 'Chạy toàn bộ test trước khi nộp', en: 'Run all tests before submitting' },
  visibleResults: { vi: 'Kết quả test mẫu', en: 'Sample test results' },
  fullResults: { vi: 'Kết quả toàn bộ test', en: 'All test results' },
  hiddenSummary: { vi: 'Test ẩn: {passed}/{total} pass', en: 'Hidden tests: {passed}/{total} pass' },
  failingCategories: { vi: 'fail ở: {list}', en: 'failing: {list}' },
  passLabel: { vi: '✓ pass', en: '✓ pass' },
  failLabel: { vi: '✗ fail', en: '✗ fail' },
  hint: { vi: 'Gợi ý {n}', en: 'Hint {n}' },
  openHint: { vi: 'Mở gợi ý {n} (−0.1 điểm)', en: 'Show hint {n} (−0.1 points)' },
  editorLoading: { vi: 'Đang tải editor…', en: 'Loading the editor…' },
  logs: { vi: 'Console', en: 'Console' },
  challengeMissing: { vi: 'Không tìm thấy file của challenge này.', en: 'This challenge’s files are missing.' },
  categoryTitle: { vi: '✗ Hay fail ở loại test', en: '✗ Test kinds you keep failing' },
  categoryLine: { vi: '{category}: fail ở {n} lần nộp', en: '{category}: failed in {n} submissions' },
  solutionTitle: { vi: 'Lời giải', en: 'Solution' },
```

- [ ] **Step 6: `src/ui/app.css`**: thêm vào ngay trước khối `@media (max-width: 720px) {`:

```css
/* Challenge */
.question.wide { max-width: 1200px; }
.challenge { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: var(--space-4); align-items: start; }
.editor { min-height: 420px; border-radius: var(--radius-lg); border: 1px solid var(--line); overflow: hidden; background: var(--surface-raised); }
.editor > .muted { margin: 0; padding: var(--space-3); }
.test-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--space-2); font-size: 14px; }
.log { margin: 0; max-height: 160px; overflow: auto; padding: var(--space-2); border-radius: var(--radius-md); background: var(--surface-raised); font-size: 12px; line-height: 18px; white-space: pre-wrap; }
.md h3, .md h4 { margin: var(--space-3) 0 var(--space-2); font: 600 18px/24px var(--font-display); }
.md h4 { font-size: 16px; }
.md p, .md ul { margin: 0 0 var(--space-2); }
.md-code { margin: 0 0 var(--space-2); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--surface-raised); font-size: 13px; line-height: 20px; white-space: pre; overflow-x: auto; }
@media (max-width: 900px) {
  .challenge { grid-template-columns: minmax(0, 1fr); }
}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/ui` (markdown 4 + format 4) và `npx tsc --noEmit`.

---

### Task 6: Màn challenge

**Files:** Create `src/screens/questions/ChallengeView.tsx`. Replace `src/screens/TestScreen.tsx`. Modify `src/screens/TodayScreen.tsx`, `src/screens/ResultScreen.tsx`

- [ ] **Step 1: Viết `src/screens/questions/ChallengeView.tsx`** (mockup màn 3)

```tsx
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { SessionService } from '../../app/sessionService';
import type { ChallengeFiles } from '../../content/load';
import type { ChallengeMeta, Localized } from '../../core/schema';
import type { TestResult } from '../../core/types';
import { useLang } from '../../i18n/LangProvider';
import type { Include, RunOutput } from '../../runner/execute';
import { runInWorker } from '../../runner/runInWorker';
import { Button, Rich } from '../../ui/components';
import { Markdown } from '../../ui/Markdown';

const CodeEditor = lazy(() => import('../../ui/CodeEditor'));
const SAVE_DELAY_MS = 500;

export function ChallengeView({ item, files, prompt, service, text, usedHints, onHint, onFullRun }: {
  item: ChallengeMeta;
  files: ChallengeFiles;
  prompt: string;
  service: SessionService;
  text: (l: Localized) => string;
  usedHints: number;
  onHint: () => void;
  /** the latest full run, or null once the code changes after it */
  onFullRun: (tests: TestResult[] | null) => void;
}) {
  const { t } = useLang();
  const [code, setCode] = useState<string>();
  const [running, setRunning] = useState<Include | null>(null);
  const [output, setOutput] = useState<{ include: Include; result: RunOutput }>();
  const loaded = useRef(false);

  useEffect(() => {
    let live = true;
    service.loadDraft(item.id).then(
      (saved) => {
        if (live) setCode(saved ?? files.starter);
      },
      () => {
        if (live) setCode(files.starter);
      },
    );
    return () => {
      live = false;
    };
  }, [service, item.id, files.starter]);

  useEffect(() => {
    if (code === undefined) return;
    // the first value is the one just loaded; there is nothing new to save
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    const id = window.setTimeout(() => {
      service.saveDraft(item.id, code).catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [service, item.id, code]);

  function edit(next: string) {
    setCode(next);
    if (output?.include === 'all') {
      setOutput(undefined);
      onFullRun(null);
    }
  }

  async function runTests(include: Include) {
    if (code === undefined || running) return;
    setRunning(include);
    const result = await runInWorker({ solution: code, tests: files.tests, include });
    setRunning(null);
    setOutput({ include, result });
    if (include === 'all') onFullRun(result.results);
  }

  const visible = output?.result.results.filter((r) => !r.hidden) ?? [];
  const hidden = output?.result.results.filter((r) => r.hidden) ?? [];
  const failing = [...new Set(hidden.filter((r) => !r.pass).map((r) => r.category))];

  return (
    <div className="challenge">
      <section className="stack">
        <Markdown source={prompt} />
        {item.hints.length > 0 ? (
          <div className="card stack" style={{ gap: 'var(--space-2)' }}>
            {item.hints.slice(0, usedHints).map((hint, i) => (
              <p key={i} style={{ margin: 0 }}>
                <span className="label">{t('hint', { n: i + 1 })}</span> <Rich text={text(hint)} />
              </p>
            ))}
            {usedHints < item.hints.length ? (
              <Button className="btn-small" onClick={onHint}>{t('openHint', { n: usedHints + 1 })}</Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="stack">
        <div className="editor">
          {code === undefined ? (
            <p className="muted">{t('editorLoading')}</p>
          ) : (
            <Suspense fallback={<p className="muted">{t('editorLoading')}</p>}>
              <CodeEditor value={code} onChange={edit} />
            </Suspense>
          )}
        </div>
        <div className="row">
          <Button disabled={code === undefined || running !== null} onClick={() => void runTests('visible')}>
            {running === 'visible' ? t('running') : t('runVisible')}
          </Button>
          <Button disabled={code === undefined || running !== null} onClick={() => void runTests('all')}>
            {running === 'all' ? t('running') : t('runAll')}
          </Button>
          {output?.include !== 'all' ? <span className="muted">{t('runFirst')}</span> : null}
        </div>
        {output ? (
          <div className="panel stack" aria-live="polite" style={{ gap: 'var(--space-2)' }}>
            <span className="label">{t(output.include === 'all' ? 'fullResults' : 'visibleResults')}</span>
            {output.result.error ? <p className="num down" style={{ margin: 0 }}>{output.result.error}</p> : null}
            <ul className="test-list">
              {visible.map((r) => (
                <li key={r.name}>
                  <span className={r.pass ? 'up' : 'down'}>{t(r.pass ? 'passLabel' : 'failLabel')}</span> {r.name}{' '}
                  <span className="muted">· {r.category}</span>
                  {r.error ? <div className="num muted">{r.error}</div> : null}
                </li>
              ))}
            </ul>
            {output.include === 'all' ? (
              <p className="muted" style={{ margin: 0 }}>
                {t('hiddenSummary', { passed: hidden.filter((r) => r.pass).length, total: hidden.length })}
                {failing.length > 0 ? ` · ${t('failingCategories', { list: failing.join(', ') })}` : ''}
              </p>
            ) : null}
            {output.result.logs.length > 0 ? (
              <>
                <span className="label">{t('logs')}</span>
                <pre className="log">{output.result.logs.join('\n')}</pre>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Thay `src/screens/TestScreen.tsx`**. Bản này giữ nguyên mọi thứ của P2 và thêm nhánh challenge. Các `setDraft` từ callback bất đồng bộ của challenge dùng dạng functional.

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY_DRAFT, toResponse, type Draft } from '../app/draft';
import { href, navigate } from '../app/router';
import type { LoadedSession, SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import { PASS_SCORE } from '../core/scheduler';
import type { Item, Localized } from '../core/schema';
import type { Confidence } from '../core/types';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { NotFound } from '../ui/Chrome';
import { Button, Chip, Rich, Segments, type SegmentState } from '../ui/components';
import { formatClock, otherLang } from '../ui/format';
import { useNow } from '../ui/useNow';
import { ChallengeView } from './questions/ChallengeView';
import { McqView } from './questions/McqView';
import { OpenView } from './questions/OpenView';
import { SpotBugView } from './questions/SpotBugView';

const CONFIDENCE: Confidence[] = ['guess', 'fairly', 'sure'];

export function TestScreen({ service, content, sessionId }: { service: SessionService; content: Content; sessionId: string }) {
  const { lang, t } = useLang();
  const now = useNow();
  const byId = useMemo(() => new Map(content.items.map((i) => [i.id, i])), [content]);
  const [data, setData] = useState<LoadedSession | null>();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [alt, setAlt] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const currentId = data ? data.session.itemIds.find((id) => byId.has(id) && !data.attempts.some((a) => a.itemId === id)) : undefined;

  // Move focus to each new question so keyboard and screen-reader users start there.
  useEffect(() => {
    titleRef.current?.focus();
  }, [currentId]);

  useEffect(() => {
    let live = true;
    void service.load(sessionId).then((d) => {
      if (live) setData(d ?? null);
    });
    return () => {
      live = false;
    };
  }, [service, sessionId]);

  if (data === undefined) return <p className="page muted">{t('loading')}</p>;
  if (data === null) return <NotFound />;

  const { session, attempts } = data;
  const answered = new Map(attempts.map((a) => [a.itemId, a]));
  const index = session.itemIds.findIndex((id) => byId.has(id) && !answered.has(id));
  const item = index === -1 ? undefined : byId.get(session.itemIds[index]);
  const textLang = alt ? otherLang(lang) : lang;
  const text = (l: Localized) => l[textLang];
  const remaining = session.durationMin * 60 - (now - session.startedAt) / 1000;
  const states: SegmentState[] = session.itemIds.map((id, i) => {
    const a = answered.get(id);
    if (a) return a.score >= PASS_SCORE ? 'correct' : 'wrong';
    return i === index ? 'current' : 'todo';
  });

  async function finish() {
    await service.finish(sessionId, Date.now());
    navigate({ name: 'result', sessionId });
  }

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await work();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function submit(target: Item) {
    const response = toResponse(target, draft);
    if (!response || !draft.confidence) return;
    const confidence = draft.confidence;
    await run(async () => {
      const attempt = await service.answer({
        sessionId, itemId: target.id, response, confidence,
        timeSpent: Math.round((Date.now() - shownAt) / 1000), lang: textLang, now: Date.now(),
      });
      if (session.itemIds.every((id) => id === target.id || answered.has(id) || !byId.has(id))) {
        await finish();
        return;
      }
      setData({ session, attempts: [...attempts, attempt] });
      setDraft(EMPTY_DRAFT);
      setAlt(false);
      setShownAt(Date.now());
    });
  }

  const position = index === -1 ? session.itemIds.length : index + 1;
  const header = (
    <header className="test-header">
      <a href={href({ name: 'today' })}>{t('exit')}</a>
      <div className="stack grow" style={{ gap: 'var(--space-2)' }}>
        <div className="row between muted">
          <span className="num">{t('questionOf', { i: position, n: session.itemIds.length })}</span>
          <span>{t(session.mode === 'daily' ? 'dailyTag' : 'practiceTag', { d: session.durationMin })}</span>
        </div>
        <Segments states={states} />
      </div>
      <span className={remaining < 0 ? 'numeral overtime' : 'numeral'} title={t('timeLeft')}>{formatClock(remaining)}</span>
    </header>
  );
  const alert = failed ? <p role="alert" className="muted down">{t('saveFailed')}</p> : null;

  if (!item) {
    return (
      <>
        {header}
        <main className="question">
          {session.finishedAt !== undefined ? (
            <a className="btn btn-primary" href={href({ name: 'result', sessionId })}>{t('finishSession')}</a>
          ) : (
            <Button variant="primary" disabled={busy} onClick={() => void run(finish)}>{t('finishSession')}</Button>
          )}
          {alert}
        </main>
      </>
    );
  }

  const ready = toResponse(item, draft) !== null && draft.confidence !== null;
  const files = item.type === 'challenge' ? content.challenges[item.id] : undefined;

  return (
    <>
      {header}
      <main className={item.type === 'challenge' ? 'question wide' : 'question'}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Chip><span className="label">{t(`kind_${item.kind}` as UiKey)}</span></Chip>
          <Chip><span className="label">{t(`diff_${item.difficulty}` as UiKey)}</span></Chip>
          <Chip mono>{item.topics[0]}</Chip>
          <span className="grow" />
          <Button className="btn-small" onClick={() => setAlt(!alt)}>{t(alt ? 'showOwn' : 'showOther')}</Button>
        </div>

        <h2 ref={titleRef} tabIndex={-1} className="title">
          <Rich text={item.type === 'challenge' ? text(item.title) : text(item.prompt)} />
        </h2>

        {item.type === 'mcq' ? (
          <>
            <span className="muted">{t(item.multi ? 'selectAll' : 'selectOne')}</span>
            <McqView key={item.id} item={item} selected={draft.selected} onChange={(selected) => setDraft({ ...draft, selected })} text={text} />
          </>
        ) : null}
        {item.type === 'spot-bug' ? (
          <SpotBugView key={item.id} item={item} line={draft.line} cause={draft.cause} onChange={(v) => setDraft({ ...draft, ...v })} text={text} />
        ) : null}
        {item.type === 'open' ? (
          <OpenView
            key={item.id}
            item={item}
            hits={draft.hits}
            revealed={draft.revealed}
            onReveal={() => setDraft({ ...draft, revealed: true })}
            onHits={(hits) => setDraft({ ...draft, hits })}
            text={text}
          />
        ) : null}
        {item.type === 'challenge' ? (
          files ? (
            <ChallengeView
              key={item.id}
              item={item}
              files={files}
              prompt={files.prompt[textLang]}
              service={service}
              text={text}
              usedHints={draft.usedHints}
              onHint={() => setDraft((d) => ({ ...d, usedHints: d.usedHints + 1 }))}
              onFullRun={(tests) => setDraft((d) => ({ ...d, tests }))}
            />
          ) : (
            <p role="alert" className="muted down">{t('challengeMissing')}</p>
          )
        ) : null}

        <div className="confidence">
          <span className="muted" style={{ fontSize: 14 }}>{t('confidence')}</span>
          <div role="radiogroup" aria-label={t('confidence')} className="row grow" style={{ gap: 'var(--space-2)' }}>
            {CONFIDENCE.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={draft.confidence === c} className="pill" onClick={() => setDraft({ ...draft, confidence: c })}>
                {t(c)}
              </button>
            ))}
          </div>
          <Button variant="primary" disabled={!ready || busy} onClick={() => void submit(item)}>{t('submit')}</Button>
        </div>
        {alert}
      </main>
    </>
  );
}
```

- [ ] **Step 3: `src/screens/TodayScreen.tsx`**
  - Ngay dưới dòng `const opens = …`, thêm:

```tsx
  const challenges = planItems.filter((i) => i.type === 'challenge').length;
```

  - Trong `<div className="counts">`, thêm một ô thứ ba sau ô `countOpen`:

```tsx
            <div className="stack" style={{ gap: 2 }}>
              <span className="count">{challenges}</span>
              <span className="muted">{t('countChallenge')}</span>
            </div>
```

- [ ] **Step 4: `src/screens/ResultScreen.tsx`**
  - Ngay dưới dòng `const misconceptions = …`, thêm:

```tsx
  const categories = report.diagnoses.flatMap((d) => (d.code === 'challenge-category' ? [d] : []));
```

  - Trong `<section className="two">`, ngay sau khối `{misconceptions.length > 0 ? (…) : null}`, thêm:

```tsx
        {categories.length > 0 ? (
          <div className="callout stack" style={{ gap: 'var(--space-2)' }}>
            <span className="label">{t('categoryTitle')}</span>
            {categories.map((c) => (
              <span key={c.category} className="num">{t('categoryLine', { category: c.category, n: c.failures })}</span>
            ))}
          </div>
        ) : null}
```

  - Trong `<details>` của danh sách câu sai, ngay sau dòng `{item.type === 'open' ? … : null}`, thêm:

```tsx
              {item.type === 'challenge' && content.challenges[item.id] ? (
                <>
                  <span className="label">{t('solutionTitle')}</span>
                  <pre className="md-code">{content.challenges[item.id].solution}</pre>
                </>
              ) : null}
```

- [ ] **Checkpoint (Warren):** `npm run dev`, bắt đầu một bài 45 phút.
  - Tới challenge, editor phải hiện ra, và "Chạy test mẫu" phải báo fail với starter.
  - Dán lời giải vào, bấm "Chạy toàn bộ test", rồi nộp.
  - Màn Kết quả hiện lời giải trong câu sai nếu có.

---

### Task 7: Kiểm chứng toàn phase

- [ ] **Step 1: Báo Warren** là chưa kiểm chứng, và đưa lệnh:

```bash
cd ~/Downloads/rn-interview-prep && npm run check
```

Kỳ vọng: `tsc` không lỗi, Vitest báo **132 test pass trên 20 file**. Trong đó 101 test của P2 và 31 test mới:

| File test | Test mới |
|---|---|
| harness | 12 |
| execute | 6 |
| timeouts | 1 |
| markdown | 4 |
| load | +3 |
| content | +2 |
| repo | +2 |
| sessionService | +1 (thay 1, thêm 1) |
