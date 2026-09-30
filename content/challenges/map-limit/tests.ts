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
  run.catch(() => {});
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
