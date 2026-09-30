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
