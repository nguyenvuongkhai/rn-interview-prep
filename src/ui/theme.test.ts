import { describe, expect, it } from 'vitest';
import { isThemePref, resolveTheme } from './theme';

describe('theme', () => {
  it('resolves system from the OS preference and keeps explicit choices', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('recognises stored preferences', () => {
    expect(isThemePref('light')).toBe(true);
    expect(isThemePref('blue')).toBe(false);
    expect(isThemePref(undefined)).toBe(false);
  });
});
