import { href } from '../app/router';
import { useLang } from '../i18n/LangProvider';
import { Button } from './components';
import { otherLang } from './format';

export function TopBar() {
  const { lang, setLang, t } = useLang();
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: 'today' })}>RN Interview Prep</a>
      <nav className="nav">
        <a href={href({ name: 'today' })} aria-current="page">{t('today')}</a>
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
