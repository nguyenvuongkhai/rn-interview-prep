import { takeLatest } from './solution';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('a single run resolves with the worker value', async () => {
  const search = takeLatest(async (q: string) => q.toUpperCase());
  await expect(search.run('react')).resolves.toEqual({ status: 'done', value: 'REACT' });
}, { category: 'basic' });

test('a new run cancels the previous one straight away', async () => {
  const slow = deferred<string>();
  const fast = deferred<string>();
  const search = takeLatest((q: string) => (q === 're' ? slow.promise : fast.promise));
  const first = search.run('re');
  const second = search.run('react');
  await expect(first).resolves.toEqual({ status: 'cancelled' });
  fast.resolve('react results');
  slow.resolve('re results');
  await expect(second).resolves.toEqual({ status: 'done', value: 'react results' });
}, { category: 'async-order' });

test('the superseded run gets an aborted signal', async () => {
  const signals: AbortSignal[] = [];
  const search = takeLatest((_q: string, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<string>(() => {});
  });
  search.run('a').catch(() => {});
  search.run('ab').catch(() => {});
  expect(signals.length).toBe(2);
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
}, { category: 'basic' });

test('a late error from a cancelled run is ignored', async () => {
  const old = deferred<string>();
  const search = takeLatest((q: string) => (q === 'old' ? old.promise : Promise.resolve('new')));
  const first = search.run('old');
  const second = search.run('new');
  old.reject(new Error('network down'));
  await expect(first).resolves.toEqual({ status: 'cancelled' });
  await expect(second).resolves.toEqual({ status: 'done', value: 'new' });
}, { category: 'edge-case', hidden: true });

test('the latest run rejects with the worker error', async () => {
  const search = takeLatest(async (_q: string): Promise<string> => {
    throw new Error('500 from search');
  });
  await expect(search.run('react')).rejects.toThrow('500 from search');
}, { category: 'edge-case', hidden: true });

test('cancel aborts the run in flight and the next run still works', async () => {
  const pending = deferred<number>();
  const signals: AbortSignal[] = [];
  const load = takeLatest((page: number, signal: AbortSignal) => {
    signals.push(signal);
    return page === 1 ? pending.promise : Promise.resolve(page * 10);
  });
  load.cancel();
  const first = load.run(1);
  load.cancel();
  load.cancel();
  await expect(first).resolves.toEqual({ status: 'cancelled' });
  expect(signals[0].aborted).toBe(true);
  pending.resolve(10);
  await expect(load.run(2)).resolves.toEqual({ status: 'done', value: 20 });
}, { category: 'edge-case', hidden: true });
