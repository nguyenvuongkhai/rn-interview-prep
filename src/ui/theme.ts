export type ThemePref = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

export const THEME_PREFS: ThemePref[] = ['dark', 'light', 'system'];

export function resolveTheme(pref: ThemePref, prefersDark: boolean): Theme {
  if (pref === 'system') return prefersDark ? 'dark' : 'light';
  return pref;
}

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'dark' || value === 'light' || value === 'system';
}
