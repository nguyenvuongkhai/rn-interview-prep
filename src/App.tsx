import { useCallback, useEffect, useState } from 'react';
import { useRoute } from './app/router';
import { createSessionService, type SessionService } from './app/sessionService';
import { content } from './content';
import type { Lang } from './core/types';
import { LangProvider } from './i18n/LangProvider';
import { LessonScreen } from './screens/LessonScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TestScreen } from './screens/TestScreen';
import { TodayScreen } from './screens/TodayScreen';
import { openRepo } from './storage/openRepo';
import { createMemoryRepo, type Repo } from './storage/repo';
import { StorageBanner, TopBar } from './ui/Chrome';
import { isThemePref, type ThemePref } from './ui/theme';
import { ThemeProvider } from './ui/ThemeProvider';

interface Booted {
  repo: Repo;
  persistent: boolean;
  lang: Lang;
  theme: ThemePref;
  service: SessionService;
}

export function App() {
  const route = useRoute();
  const [boot, setBoot] = useState<Booted>();

  useEffect(() => {
    let live = true;
    const ready = (repo: Repo, persistent: boolean, lang: Lang, theme: ThemePref) => {
      if (live) setBoot({ repo, persistent, lang, theme, service: createSessionService(repo, content) });
    };
    void openRepo()
      .then(async ({ repo, persistent }) => {
        const [lang, theme] = await Promise.all([repo.getSetting<unknown>('lang'), repo.getSetting<unknown>('theme')]);
        ready(repo, persistent, lang === 'en' ? 'en' : 'vi', isThemePref(theme) ? theme : 'dark');
      })
      .catch(() => ready(createMemoryRepo(), false, 'vi', 'dark'));
    return () => {
      live = false;
    };
  }, []);

  const saveLang = useCallback(
    (lang: Lang) => {
      void boot?.repo.setSetting('lang', lang);
    },
    [boot],
  );
  const saveTheme = useCallback(
    (theme: ThemePref) => {
      void boot?.repo.setSetting('theme', theme);
    },
    [boot],
  );

  if (!boot) return null;
  const { service } = boot;

  return (
    <ThemeProvider initial={boot.theme} onChange={saveTheme}>
      <LangProvider initial={boot.lang} onChange={saveLang}>
        {route.name !== 'test' ? <TopBar route={route} /> : null}
        {!boot.persistent ? <StorageBanner /> : null}
        {route.name === 'today' ? <TodayScreen service={service} content={content} /> : null}
        {route.name === 'test' ? <TestScreen key={route.sessionId} service={service} content={content} sessionId={route.sessionId} /> : null}
        {route.name === 'result' ? <ResultScreen key={route.sessionId} service={service} content={content} sessionId={route.sessionId} /> : null}
        {route.name === 'library' ? <LibraryScreen service={service} content={content} /> : null}
        {route.name === 'lesson' ? <LessonScreen key={route.lessonId} service={service} content={content} lessonId={route.lessonId} /> : null}
        {route.name === 'progress' ? <ProgressScreen service={service} content={content} /> : null}
        {route.name === 'settings' ? <SettingsScreen service={service} persistent={boot.persistent} /> : null}
      </LangProvider>
    </ThemeProvider>
  );
}
