import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, shuffle } from './random';

describe('random', () => {
  it('hashString is stable and differs by input', () => {
    expect(hashString('2026-10-01:30')).toBe(hashString('2026-10-01:30'));
    expect(hashString('2026-10-01:30')).not.toBe(hashString('2026-10-02:30'));
  });

  it('mulberry32 repeats for the same seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('shuffle returns a permutation without mutating the input', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const out = shuffle(input, mulberry32(7));
    expect(input).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect([...out].sort((x, y) => x - y)).toEqual(input);
    expect(out).toEqual(shuffle(input, mulberry32(7)));
  });
});
