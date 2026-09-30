import { href, type Route } from '../app/router';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { Button } from './components';
import { otherLang } from './format';

const NAV: { name: 'today' | 'library' | 'progress' | 'settings'; label: UiKey }[] = [
  { name: 'today', label: 'today' },
  { name: 'library', label: 'library' },
  { name: 'progress', label: 'progress' },
  { name: 'settings', label: 'settings' },
];

export function TopBar({ route }: { route: Route }) {
  const { lang, setLang, t } = useLang();
  const section = route.name === 'lesson' ? 'library' : route.name === 'result' ? 'today' : route.name;
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: 'today' })}>RN Interview Prep</a>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n.name} href={href({ name: n.name })} aria-current={section === n.name ? 'page' : undefined}>
            {t(n.label)}
          </a>
        ))}
      </nav>
      <Button className="btn-small" onClick={() => setLang(otherLang(lang))}>VI ⇄ EN</Button>
    </header>
  );
}

export function StorageBanner() {
  const { t } = useLang();
  return <p role="alert" className="banner">{t('storageBanner')}</p>;
}

export function NotFound() {
  const { t } = useLang();
  return (
    <main className="page stack">
      <p>{t('notFound')}</p>
      <a href={href({ name: 'today' })}>{t('backToday')}</a>
    </main>
  );
}
