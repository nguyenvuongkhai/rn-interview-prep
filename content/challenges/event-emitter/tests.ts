import { createEmitter } from './solution';

test('delivers the payload to each listener in order', () => {
  const e = createEmitter<{ progress: number }>();
  const calls: string[] = [];
  e.on('progress', (n) => calls.push(`a${n}`));
  e.on('progress', (n) => calls.push(`b${n}`));
  e.emit('progress', 1);
  e.emit('progress', 2);
  expect(calls).toEqual(['a1', 'b1', 'a2', 'b2']);
  expect(e.listenerCount('progress')).toBe(2);
}, { category: 'basic' });

test('unsubscribe and once remove listeners', () => {
  const e = createEmitter<{ done: string }>();
  const calls: string[] = [];
  const off = e.on('done', (s) => calls.push(`on:${s}`));
  e.once('done', (s) => calls.push(`once:${s}`));
  expect(e.listenerCount('done')).toBe(2);
  e.emit('done', 'x');
  expect(e.listenerCount('done')).toBe(1);
  off();
  off();
  e.emit('done', 'y');
  expect(calls).toEqual(['on:x', 'once:x']);
  expect(e.listenerCount('done')).toBe(0);
}, { category: 'basic' });

test('a listener added during emit waits for the next emit', () => {
  const e = createEmitter<{ tick: number }>();
  const calls: string[] = [];
  e.on('tick', (n) => {
    calls.push(`first${n}`);
    if (n === 1) e.on('tick', (m) => calls.push(`late${m}`));
  });
  e.emit('tick', 1);
  e.emit('tick', 2);
  expect(calls).toEqual(['first1', 'first2', 'late2']);
}, { category: 'edge-case' });

test('removing listeners during emit is safe', () => {
  const e = createEmitter<{ tick: number }>();
  const calls: string[] = [];
  const offA = e.on('tick', () => {
    calls.push('a');
    offA();
  });
  e.on('tick', () => {
    calls.push('b');
    offC();
  });
  const offC = e.on('tick', () => calls.push('c'));
  e.on('tick', () => calls.push('d'));
  e.emit('tick', 1);
  e.emit('tick', 2);
  expect(calls).toEqual(['a', 'b', 'd', 'b', 'd']);
  expect(e.listenerCount('tick')).toBe(2);
}, { category: 'edge-case', hidden: true });

test('a throwing listener does not stop the others', () => {
  const e = createEmitter<{ save: string }>();
  const calls: string[] = [];
  e.on('save', () => {
    throw new Error('first failure');
  });
  e.on('save', (s) => calls.push(s));
  e.on('save', () => {
    throw new Error('second failure');
  });
  expect(() => e.emit('save', 'draft')).toThrow('first failure');
  expect(calls).toEqual(['draft']);
}, { category: 'edge-case', hidden: true });

test('once runs a single time even if it emits the same event', () => {
  const e = createEmitter<{ ready: number }>();
  const calls: number[] = [];
  e.once('ready', (n) => {
    calls.push(n);
    e.emit('ready', n + 1);
  });
  e.emit('ready', 1);
  e.emit('ready', 5);
  expect(calls).toEqual([1]);
  expect(e.listenerCount('ready')).toBe(0);
}, { category: 'edge-case', hidden: true });
