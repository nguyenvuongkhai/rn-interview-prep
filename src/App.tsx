import { useCallback, useEffect, useState } from 'react';
import { useRoute } from './app/router';
import { createSessionService, type SessionService } from './app/sessionService';
import { content } from './content';
import type { Lang } from './core/types';
import { LangProvider } from './i18n/LangProvider';
import { ResultScreen } from './screens/ResultScreen';
import { TestScreen } from './screens/TestScreen';
import { TodayScreen } from './screens/TodayScreen';
import { openRepo } from './storage/openRepo';
import type { Repo } from './storage/repo';
import { StorageBanner, TopBar } from './ui/Chrome';

interface Booted {
  repo: Repo;
  persistent: boolean;
  lang: Lang;
  service: SessionService;
}

export function App() {
  const route = useRoute();
  const [boot, setBoot] = useState<Booted>();

  useEffect(() => {
    void openRepo().then(async ({ repo, persistent }) => {
      const lang = (await repo.getSetting<Lang>('lang')) ?? 'vi';
      setBoot({ repo, persistent, lang, service: createSessionService(repo, content) });
    });
  }, []);

  const saveLang = useCallback(
    (lang: Lang) => {
      void boot?.repo.setSetting('lang', lang);
    },
    [boot],
  );

  if (!boot) return null;

  return (
    <LangProvider initial={boot.lang} onChange={saveLang}>
      {route.name !== 'test' ? <TopBar /> : null}
      {!boot.persistent ? <StorageBanner /> : null}
      {route.name === 'today' ? <TodayScreen service={boot.service} content={content} /> : null}
      {route.name === 'test' ? <TestScreen key={route.sessionId} service={boot.service} content={content} sessionId={route.sessionId} /> : null}
      {route.name === 'result' ? <ResultScreen key={route.sessionId} service={boot.service} content={content} sessionId={route.sessionId} /> : null}
    </LangProvider>
  );
}
