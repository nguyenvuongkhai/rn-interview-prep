import { createLayout } from './solution';

const fixed = (count: number, height: number) => Array.from({ length: count }, () => height);

test('fixed rows: offsets and the visible rows', () => {
  const layout = createLayout(fixed(10, 100));
  expect(layout.totalHeight).toBe(1000);
  expect(layout.offsetOf(3)).toBe(300);
  expect(layout.range(0, 300, 1)).toEqual({ first: 0, last: 2 });
  expect(layout.range(120, 150, 1)).toEqual({ first: 1, last: 2 });
}, { category: 'basic' });

test('windowSize adds half a window above and below', () => {
  const layout = createLayout(fixed(20, 100));
  // ext = 300, region [700, 1600]: row 6 ends at 700 and row 16 starts at 1600, both only touch it
  expect(layout.range(1000, 300, 3)).toEqual({ first: 7, last: 15 });
}, { category: 'basic' });

test('variable heights', () => {
  const layout = createLayout([50, 200, 30, 120, 80]);
  expect(layout.offsetOf(4)).toBe(400);
  expect(layout.range(60, 200, 1)).toEqual({ first: 1, last: 2 });
  expect(layout.range(0, 1000, 1)).toEqual({ first: 0, last: 4 });
}, { category: 'edge-case' });

test('clamps a bounced or overscrolled offset', () => {
  const layout = createLayout(fixed(10, 100));
  expect(layout.range(-40, 300, 1)).toEqual({ first: 0, last: 2 });
  expect(layout.range(900, 300, 1)).toEqual({ first: 9, last: 9 });
  expect(layout.range(5000, 300, 1)).toBe(null);
}, { category: 'edge-case', hidden: true });

test('an empty list', () => {
  const layout = createLayout([]);
  expect(layout.totalHeight).toBe(0);
  expect(layout.range(0, 800, 21)).toBe(null);
}, { category: 'edge-case', hidden: true });

test('answers many range queries on a long list quickly', () => {
  const heights = Array.from({ length: 200_000 }, (_, i) => 20 + (i % 7) * 10);
  const layout = createLayout(heights);
  let checksum = 0;
  for (let q = 0; q < 50_000; q++) {
    const r = layout.range((q * 7919) % layout.totalHeight, 800, 21);
    if (r) checksum += r.last - r.first;
  }
  expect(checksum > 0).toBe(true);
  // spot-check one query against a straight scan
  const top = 1_000_000 - 8000;
  const bottom = 1_000_000 + 800 + 8000;
  let first = -1;
  let last = -1;
  let y = 0;
  heights.forEach((h, i) => {
    if (y + h > top && y < bottom) {
      if (first < 0) first = i;
      last = i;
    }
    y += h;
  });
  expect(layout.range(1_000_000, 800, 21)).toEqual({ first, last });
}, { category: 'perf', hidden: true });
