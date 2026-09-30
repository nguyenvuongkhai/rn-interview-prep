import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveTheme, type Theme, type ThemePref } from './theme';

interface ThemeValue {
  pref: ThemePref;
  theme: Theme;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_COLOR: Record<Theme, string> = { dark: '#0a0d0c', light: '#f4f6f4' };

export function ThemeProvider({ initial, onChange, children }: { initial: ThemePref; onChange: (pref: ThemePref) => void; children: ReactNode }) {
  const [pref, setPrefState] = useState(initial);
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onQuery = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onQuery);
    return () => query.removeEventListener('change', onQuery);
  }, []);

  const theme = resolveTheme(pref, prefersDark);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const value = useMemo<ThemeValue>(
    () => ({
      pref,
      theme,
      setPref: (next) => {
        setPrefState(next);
        onChange(next);
      },
    }),
    [pref, theme, onChange],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
