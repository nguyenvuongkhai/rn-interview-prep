import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { SessionService } from '../../app/sessionService';
import type { ChallengeFiles } from '../../content/load';
import type { ChallengeMeta, Localized } from '../../core/schema';
import type { TestResult } from '../../core/types';
import { useLang } from '../../i18n/LangProvider';
import type { Include, RunOutput } from '../../runner/execute';
import { runInWorker } from '../../runner/runInWorker';
import { Button, Rich } from '../../ui/components';
import { Markdown } from '../../ui/Markdown';

const CodeEditor = lazy(() => import('../../ui/CodeEditor'));
const SAVE_DELAY_MS = 500;

export function ChallengeView({ item, files, prompt, service, text, usedHints, onHint, onFullRun }: {
  item: ChallengeMeta;
  files: ChallengeFiles;
  prompt: string;
  service: SessionService;
  text: (l: Localized) => string;
  usedHints: number;
  onHint: () => void;
  /** the latest full run, or null once the code changes after it */
  onFullRun: (tests: TestResult[] | null) => void;
}) {
  const { t } = useLang();
  const [code, setCode] = useState<string>();
  const [running, setRunning] = useState<Include | null>(null);
  const [output, setOutput] = useState<{ include: Include; result: RunOutput }>();
  const loaded = useRef(false);
  // bumped on every edit; a run whose version is stale by the time it ends cannot count as the full run
  const version = useRef(0);
  const holdsFullRun = useRef(false);
  const pendingSave = useRef<string | undefined>(undefined);
  const runAbort = useRef<AbortController | undefined>(undefined);

  // On unmount (submit, exit): stop a run in flight and keep the last unsaved edit.
  useEffect(
    () => () => {
      runAbort.current?.abort();
      if (pendingSave.current !== undefined) service.saveDraft(item.id, pendingSave.current).catch(() => undefined);
    },
    [service, item.id],
  );

  useEffect(() => {
    let live = true;
    service.loadDraft(item.id).then(
      (saved) => {
        if (live) setCode(saved ?? files.starter);
      },
      () => {
        if (live) setCode(files.starter);
      },
    );
    return () => {
      live = false;
    };
  }, [service, item.id, files.starter]);

  useEffect(() => {
    if (code === undefined) return;
    // the first value is the one just loaded; there is nothing new to save
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    pendingSave.current = code;
    const id = window.setTimeout(() => {
      pendingSave.current = undefined;
      service.saveDraft(item.id, code).catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [service, item.id, code]);

  function edit(next: string) {
    setCode(next);
    version.current++;
    if (holdsFullRun.current) {
      holdsFullRun.current = false;
      onFullRun(null);
    }
    if (output?.include === 'all') setOutput(undefined);
  }

  async function runTests(include: Include) {
    if (code === undefined || running) return;
    const startedAt = version.current;
    const abort = new AbortController();
    runAbort.current = abort;
    setRunning(include);
    const result = await runInWorker({ solution: code, tests: files.tests, include }, abort.signal);
    if (abort.signal.aborted) return;
    setRunning(null);
    setOutput({ include, result });
    if (include !== 'all' || startedAt !== version.current) return;
    // a run that could not start (syntax error, load-time throw) is not a gradable submission
    const tests = result.error && result.results.length === 0 ? null : result.results;
    holdsFullRun.current = tests !== null;
    onFullRun(tests);
  }

  const visible = output?.result.results.filter((r) => !r.hidden) ?? [];
  const hidden = output?.result.results.filter((r) => r.hidden) ?? [];
  const failing = [...new Set(hidden.filter((r) => !r.pass).map((r) => r.category))];

  return (
    <div className="challenge">
      <section className="stack">
        <Markdown source={prompt} />
        {item.hints.length > 0 ? (
          <div className="card stack" style={{ gap: 'var(--space-2)' }}>
            {item.hints.slice(0, usedHints).map((hint, i) => (
              <p key={i} style={{ margin: 0 }}>
                <span className="label">{t('hint', { n: i + 1 })}</span> <Rich text={text(hint)} />
              </p>
            ))}
            {usedHints < item.hints.length ? (
              <Button className="btn-small" onClick={onHint}>{t('openHint', { n: usedHints + 1 })}</Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="stack">
        <div className="editor">
          {code === undefined ? (
            <p className="muted">{t('editorLoading')}</p>
          ) : (
            <Suspense fallback={<p className="muted">{t('editorLoading')}</p>}>
              <CodeEditor value={code} onChange={edit} />
            </Suspense>
          )}
        </div>
        <div className="row">
          <Button disabled={code === undefined || running !== null} onClick={() => void runTests('visible')}>
            {running === 'visible' ? t('running') : t('runVisible')}
          </Button>
          <Button disabled={code === undefined || running !== null} onClick={() => void runTests('all')}>
            {running === 'all' ? t('running') : t('runAll')}
          </Button>
          {output?.include !== 'all' ? <span className="muted">{t('runFirst')}</span> : null}
        </div>
        {output ? (
          <div className="panel stack" aria-live="polite" style={{ gap: 'var(--space-2)' }}>
            <span className="label">{t(output.include === 'all' ? 'fullResults' : 'visibleResults')}</span>
            {output.result.error ? <p className="num down" style={{ margin: 0 }}>{output.result.error}</p> : null}
            <ul className="test-list">
              {visible.map((r) => (
                <li key={r.name}>
                  <span className={r.pass ? 'up' : 'down'}>{t(r.pass ? 'passLabel' : 'failLabel')}</span> {r.name}{' '}
                  <span className="muted">· {r.category}</span>
                  {r.error ? <div className="num muted">{r.error}</div> : null}
                </li>
              ))}
            </ul>
            {output.include === 'all' ? (
              <p className="muted" style={{ margin: 0 }}>
                {t('hiddenSummary', { passed: hidden.filter((r) => r.pass).length, total: hidden.length })}
                {failing.length > 0 ? ` · ${t('failingCategories', { list: failing.join(', ') })}` : ''}
              </p>
            ) : null}
            {output.result.logs.length > 0 ? (
              <>
                <span className="label">{t('logs')}</span>
                <pre className="log">{output.result.logs.join('\n')}</pre>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
