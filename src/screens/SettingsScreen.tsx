import { useState, type ChangeEvent } from 'react';
import { backupFileName, parseBackup } from '../app/backup';
import { href } from '../app/router';
import type { SessionService } from '../app/sessionService';
import type { Lang } from '../core/types';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import type { Snapshot } from '../storage/repo';
import { Button } from '../ui/components';
import { downloadJson } from '../ui/download';
import { THEME_PREFS } from '../ui/theme';
import { useTheme } from '../ui/ThemeProvider';

const LANGS: Lang[] = ['vi', 'en'];

export function SettingsScreen({ service }: { service: SessionService }) {
  const { lang, setLang, t } = useLang();
  const { pref, setPref } = useTheme();
  const [pending, setPending] = useState<Snapshot>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  async function downloadBackup() {
    const backup = await service.exportBackup(Date.now());
    downloadJson(backupFileName(backup.exportedAt), backup);
  }

  async function exportNow() {
    setMessage(undefined);
    try {
      await downloadBackup();
      setMessage({ ok: true, text: t('exported') });
    } catch {
      setMessage({ ok: false, text: t('saveFailed') });
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage(undefined);
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setPending(undefined);
      setMessage({ ok: false, text: t('importFailed', { reason: e instanceof Error ? e.message : String(e) }) });
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      await downloadBackup();
      await service.importBackup(pending);
      // restart so language, theme and every screen read the restored data
      window.location.hash = href({ name: 'today' });
      window.location.reload();
    } catch {
      setMessage({ ok: false, text: t('saveFailed') });
      setBusy(false);
    }
  }

  return (
    <main className="page narrow stack" style={{ gap: 'var(--space-5)' }}>
      <h1 className="display">{t('settingsTitle')}</h1>

      <section className="stack">
        <h2 className="title">{t('themeTitle')}</h2>
        <div role="radiogroup" aria-label={t('themeTitle')} className="row" style={{ gap: 'var(--space-2)' }}>
          {THEME_PREFS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={pref === p} className="pill" onClick={() => setPref(p)}>
              {t(`theme_${p}` as UiKey)}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="title">{t('languageTitle')}</h2>
        <div role="radiogroup" aria-label={t('languageTitle')} className="row" style={{ gap: 'var(--space-2)' }}>
          {LANGS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={lang === l} className="pill" onClick={() => setLang(l)}>
              {t(`lang_${l}` as UiKey)}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="title">{t('backupTitle')}</h2>
        <p className="lead">{t('backupHelp')}</p>
        <div className="row">
          <Button onClick={() => void exportNow()}>{t('exportButton')}</Button>
        </div>
        <label className="stack" style={{ gap: 'var(--space-2)' }} htmlFor="backup-file">
          <span className="muted">{t('importLabel')}</span>
          <input id="backup-file" type="file" accept="application/json,.json" className="file-input" onChange={(e) => void onFile(e)} />
        </label>
        {pending ? (
          <div className="panel stack" style={{ gap: 'var(--space-3)' }}>
            <p style={{ margin: 0 }}>{t('importConfirm', { s: pending.sessions.length, a: pending.attempts.length })}</p>
            <div className="row">
              <Button variant="primary" disabled={busy} onClick={() => void confirmImport()}>{t('importRun')}</Button>
              <Button disabled={busy} onClick={() => setPending(undefined)}>{t('cancel')}</Button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'muted up' : 'muted down'}>{message.text}</p>
        ) : null}
      </section>
    </main>
  );
}
