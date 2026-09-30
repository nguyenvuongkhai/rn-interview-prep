import { describe, expect, it } from 'vitest';
import { format, formatClock, formatScore, otherLang } from './format';

describe('format', () => {
  it('formatClock pads minutes and seconds', () => {
    expect(formatClock(1122)).toBe('18:42');
    expect(formatClock(5)).toBe('00:05');
  });

  it('formatClock shows overtime with a plus', () => {
    expect(formatClock(-72)).toBe('+01:12');
  });

  it('formatScore uses two decimals', () => {
    expect(formatScore(0.7249)).toBe('0.72');
    expect(formatScore(1)).toBe('1.00');
  });

  it('format fills named slots and keeps unknown ones', () => {
    expect(format('Câu {i} / {n}', { i: 4, n: 12 })).toBe('Câu 4 / 12');
    expect(format('{x} left', {})).toBe('{x} left');
    expect(otherLang('vi')).toBe('en');
  });
});
