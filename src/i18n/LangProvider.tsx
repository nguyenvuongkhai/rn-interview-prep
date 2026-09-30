import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Localized } from '../core/schema';
import type { Lang } from '../core/types';
import { format } from '../ui/format';
import { UI, type UiKey } from './strings';

interface LangValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: UiKey, vars?: Record<string, string | number>) => string;
  pick: (text: Localized) => string;
}

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ initial, onChange, children }: { initial: Lang; onChange: (lang: Lang) => void; children: ReactNode }) {
  const [lang, setLangState] = useState(initial);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangValue>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        onChange(next);
      },
      t: (key, vars) => format(UI[key][lang], vars),
      pick: (text) => text[lang],
    }),
    [lang, onChange],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const value = useContext(LangContext);
  if (!value) throw new Error('useLang must be used inside LangProvider');
  return value;
}
