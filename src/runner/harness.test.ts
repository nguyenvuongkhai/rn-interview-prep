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
