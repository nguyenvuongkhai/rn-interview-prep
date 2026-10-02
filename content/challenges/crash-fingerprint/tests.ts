import { groupCrashes, normaliseFrame } from './solution';
import type { CrashReport } from './solution';

test('normalises line numbers, bundle query strings and addresses', () => {
  expect(normaliseFrame('at renderCart (index.android.bundle?platform=android&hash=9f2c1e:1:20431)')).toBe(
    'renderCart (index.android.bundle)',
  );
  expect(normaliseFrame('com.shop.cart.CartModule.load(CartModule.kt:42)')).toBe('com.shop.cart.CartModule.load(CartModule.kt)');
  expect(normaliseFrame('  CartView.reload 0x0000000104a8c2f4 (CartView.swift:88)')).toBe('CartView.reload (CartView.swift)');
  expect(normaliseFrame('java.lang.reflect.Method.invoke(Native Method)')).toBe('java.lang.reflect.Method.invoke(Native Method)');
}, { category: 'basic' });

test('groups the same crash across builds and sorts by count', () => {
  const reports: CrashReport[] = [
    { id: 'r1', timestamp: 100, frames: ['at CartTotal (index.android.bundle?hash=aaa:1:2001)', 'at renderCart (index.android.bundle?hash=aaa:1:1500)'] },
    { id: 'r2', timestamp: 200, frames: ['at ProfileHeader (index.android.bundle?hash=aaa:1:900)'] },
    { id: 'r3', timestamp: 300, frames: ['at CartTotal (index.android.bundle?hash=bbb:1:2311)', 'at renderCart (index.android.bundle?hash=bbb:1:1720)'] },
  ];
  expect(groupCrashes(reports, { ignorePrefixes: [], topN: 3 })).toEqual([
    {
      fingerprint: 'CartTotal (index.android.bundle)\nrenderCart (index.android.bundle)',
      count: 2,
      firstSeen: 100,
      lastSeen: 300,
      reportIds: ['r1', 'r3'],
    },
    { fingerprint: 'ProfileHeader (index.android.bundle)', count: 1, firstSeen: 200, lastSeen: 200, reportIds: ['r2'] },
  ]);
}, { category: 'basic' });

test('skips library frames and keeps only the top N app frames', () => {
  const reports: CrashReport[] = [
    {
      id: 'a1',
      timestamp: 10,
      frames: [
        'java.util.ArrayList.get(ArrayList.java:437)',
        'com.shop.pay.Gateway.send(Gateway.kt:41)',
        'com.shop.pay.PayModule.charge(PayModule.kt:88)',
        'com.facebook.react.bridge.JavaMethodWrapper.invoke(JavaMethodWrapper.java:372)',
      ],
    },
    {
      id: 'a2',
      timestamp: 20,
      frames: [
        'java.util.ArrayList.get(ArrayList.java:411)',
        'com.shop.pay.Gateway.send(Gateway.kt:44)',
        'com.shop.pay.PayModule.charge(PayModule.kt:90)',
        'com.shop.pay.PayModule.retry(PayModule.kt:120)',
      ],
    },
    {
      id: 'a3',
      timestamp: 30,
      frames: [
        'at onPressCheckout (src/screens/Cart.tsx:57:9)',
        'at Pressable.onPress (node_modules/react-native/Libraries/Components/Pressable/Pressable.js:220:7)',
        'at dispatchEvent (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-prod.js:1:5120)',
      ],
    },
  ];
  const options = { ignorePrefixes: ['com.facebook.', 'java.', 'node_modules/'], topN: 2 };
  expect(groupCrashes(reports, options)).toEqual([
    {
      fingerprint: 'com.shop.pay.Gateway.send(Gateway.kt)\ncom.shop.pay.PayModule.charge(PayModule.kt)',
      count: 2,
      firstSeen: 10,
      lastSeen: 20,
      reportIds: ['a1', 'a2'],
    },
    { fingerprint: 'onPressCheckout (src/screens/Cart.tsx)', count: 1, firstSeen: 30, lastSeen: 30, reportIds: ['a3'] },
  ]);
}, { category: 'basic' });

test('falls back to the top normalised frames when no app frame is left', () => {
  const reports: CrashReport[] = [
    {
      id: 'n1',
      timestamp: 5,
      frames: [
        'com.facebook.react.bridge.queue.NativeRunnable.run(Native Method)',
        'com.facebook.react.bridge.queue.MessageQueueThreadHandler.dispatchMessage(MessageQueueThreadHandler.java:27)',
        'java.lang.Thread.run(Thread.java:1012)',
      ],
    },
    { id: 'n3', timestamp: 7, frames: [] },
    {
      id: 'n2',
      timestamp: 9,
      frames: [
        'com.facebook.react.bridge.queue.NativeRunnable.run(Native Method)',
        'com.facebook.react.bridge.queue.MessageQueueThreadHandler.dispatchMessage(MessageQueueThreadHandler.java:29)',
        'java.lang.Thread.run(Thread.java:920)',
      ],
    },
  ];
  expect(groupCrashes(reports, { ignorePrefixes: ['com.facebook.', 'java.'], topN: 2 })).toEqual([
    {
      fingerprint:
        'com.facebook.react.bridge.queue.NativeRunnable.run(Native Method)\n' +
        'com.facebook.react.bridge.queue.MessageQueueThreadHandler.dispatchMessage(MessageQueueThreadHandler.java)',
      count: 2,
      firstSeen: 5,
      lastSeen: 9,
      reportIds: ['n1', 'n2'],
    },
    { fingerprint: '', count: 1, firstSeen: 7, lastSeen: 7, reportIds: ['n3'] },
  ]);
}, { category: 'edge-case', hidden: true });

test('handles reports that arrive out of order and breaks ties by firstSeen', () => {
  const reports: CrashReport[] = [
    { id: 'x1', timestamp: 500, frames: ['at b (app.js:1:1)'] },
    { id: 'x2', timestamp: 100, frames: ['at a (app.js:2:2)'] },
    { id: 'x3', timestamp: 50, frames: ['at b (app.js:9:9)'] },
    { id: 'x4', timestamp: 300, frames: ['at c (app.js:3:3)'] },
    { id: 'x5', timestamp: 200, frames: ['at a (app.js:4:4)'] },
  ];
  expect(groupCrashes(reports, { ignorePrefixes: [], topN: 1 })).toEqual([
    { fingerprint: 'b (app.js)', count: 2, firstSeen: 50, lastSeen: 500, reportIds: ['x1', 'x3'] },
    { fingerprint: 'a (app.js)', count: 2, firstSeen: 100, lastSeen: 200, reportIds: ['x2', 'x5'] },
    { fingerprint: 'c (app.js)', count: 1, firstSeen: 300, lastSeen: 300, reportIds: ['x4'] },
  ]);
}, { category: 'edge-case', hidden: true });

test('groups 20,000 reports into 10,000 groups quickly', () => {
  const reports: CrashReport[] = [];
  for (let i = 0; i < 20000; i++) {
    const g = i % 10000;
    reports.push({
      id: `r${i}`,
      timestamp: i,
      frames: [
        `at screen${g} (index.android.bundle?hash=h${i % 7}:1:${i})`,
        `at dispatchEvent (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-prod.js:1:${i})`,
        `at handler${g % 50} (index.android.bundle:1:${g})`,
      ],
    });
  }
  const groups = groupCrashes(reports, { ignorePrefixes: ['node_modules/'], topN: 2 });
  expect(groups.length).toBe(10000);
  expect(groups[0]).toEqual({
    fingerprint: 'screen0 (index.android.bundle)\nhandler0 (index.android.bundle)',
    count: 2,
    firstSeen: 0,
    lastSeen: 10000,
    reportIds: ['r0', 'r10000'],
  });
  expect(groups[9999].fingerprint).toBe('screen9999 (index.android.bundle)\nhandler49 (index.android.bundle)');
}, { category: 'perf', hidden: true });
