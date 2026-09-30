import { useEffect, useMemo, useState } from 'react';
import { EMPTY_DRAFT, toResponse, type Draft } from '../app/draft';
import { href, navigate } from '../app/router';
import type { LoadedSession, SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import { PASS_SCORE } from '../core/scheduler';
import type { Item, Localized } from '../core/schema';
import type { Confidence } from '../core/types';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { NotFound } from '../ui/Chrome';
import { Button, Chip, Rich, Segments, type SegmentState } from '../ui/components';
import { formatClock, otherLang } from '../ui/format';
import { useNow } from '../ui/useNow';
import { McqView } from './questions/McqView';
import { OpenView } from './questions/OpenView';
import { SpotBugView } from './questions/SpotBugView';

const CONFIDENCE: Confidence[] = ['guess', 'fairly', 'sure'];

export function TestScreen({ service, content, sessionId }: { service: SessionService; content: Content; sessionId: string }) {
  const { lang, t } = useLang();
  const now = useNow();
  const byId = useMemo(() => new Map(content.items.map((i) => [i.id, i])), [content]);
  const [data, setData] = useState<LoadedSession | null>();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [alt, setAlt] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void service.load(sessionId).then((d) => {
      if (live) setData(d ?? null);
    });
    return () => {
      live = false;
    };
  }, [service, sessionId]);

  if (data === undefined) return <p className="page muted">{t('loading')}</p>;
  if (data === null) return <NotFound />;

  const { session, attempts } = data;
  const answered = new Map(attempts.map((a) => [a.itemId, a]));
  const index = session.itemIds.findIndex((id) => !answered.has(id));
  const item = index === -1 ? undefined : byId.get(session.itemIds[index]);
  const textLang = alt ? otherLang(lang) : lang;
  const text = (l: Localized) => l[textLang];
  const remaining = session.durationMin * 60 - (now - session.startedAt) / 1000;
  const states: SegmentState[] = session.itemIds.map((id, i) => {
    const a = answered.get(id);
    if (a) return a.score >= PASS_SCORE ? 'correct' : 'wrong';
    return i === index ? 'current' : 'todo';
  });

  async function finish() {
    setBusy(true);
    await service.finish(sessionId, Date.now());
    navigate({ name: 'result', sessionId });
  }

  async function submit(target: Item) {
    const response = toResponse(target, draft);
    if (!response || !draft.confidence) return;
    setBusy(true);
    const attempt = await service.answer({
      sessionId, itemId: target.id, response, confidence: draft.confidence,
      timeSpent: Math.round((Date.now() - shownAt) / 1000), lang: textLang, now: Date.now(),
    });
    if (session.itemIds.every((id) => id === target.id || answered.has(id))) {
      await finish();
      return;
    }
    setData({ session, attempts: [...attempts, attempt] });
    setDraft(EMPTY_DRAFT);
    setAlt(false);
    setShownAt(Date.now());
    setBusy(false);
  }

  const position = index === -1 ? session.itemIds.length : index + 1;
  const header = (
    <header className="test-header">
      <a href={href({ name: 'today' })}>{t('exit')}</a>
      <div className="stack grow" style={{ gap: 'var(--space-2)' }}>
        <div className="row between muted">
          <span className="num">{t('questionOf', { i: position, n: session.itemIds.length })}</span>
          <span>{t(session.mode === 'daily' ? 'dailyTag' : 'practiceTag', { d: session.durationMin })}</span>
        </div>
        <Segments states={states} />
      </div>
      <span className={remaining < 0 ? 'numeral overtime' : 'numeral'} aria-label={t('timeLeft')}>{formatClock(remaining)}</span>
    </header>
  );

  if (!item) {
    return (
      <>
        {header}
        <main className="question">
          <Button variant="primary" disabled={busy} onClick={() => void finish()}>{t('finishSession')}</Button>
        </main>
      </>
    );
  }

  const ready = toResponse(item, draft) !== null && draft.confidence !== null;

  return (
    <>
      {header}
      <main className="question">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Chip><span className="label">{t(`kind_${item.kind}` as UiKey)}</span></Chip>
          <Chip><span className="label">{t(`diff_${item.difficulty}` as UiKey)}</span></Chip>
          <Chip mono>{item.topics[0]}</Chip>
          <span className="grow" />
          <Button className="btn-small" onClick={() => setAlt(!alt)}>{t(alt ? 'showOwn' : 'showOther')}</Button>
        </div>

        {item.type !== 'challenge' ? <h2 className="title"><Rich text={text(item.prompt)} /></h2> : null}

        {item.type === 'mcq' ? (
          <>
            <span className="muted">{t(item.multi ? 'selectAll' : 'selectOne')}</span>
            <McqView key={item.id} item={item} selected={draft.selected} onChange={(selected) => setDraft({ ...draft, selected })} text={text} />
          </>
        ) : null}
        {item.type === 'spot-bug' ? (
          <SpotBugView key={item.id} item={item} line={draft.line} cause={draft.cause} onChange={(v) => setDraft({ ...draft, ...v })} text={text} />
        ) : null}
        {item.type === 'open' ? (
          <OpenView
            key={item.id}
            item={item}
            hits={draft.hits}
            revealed={draft.revealed}
            onReveal={() => setDraft({ ...draft, revealed: true })}
            onHits={(hits) => setDraft({ ...draft, hits })}
            text={text}
          />
        ) : null}

        <div className="confidence">
          <span className="muted" style={{ fontSize: 14 }}>{t('confidence')}</span>
          <div role="radiogroup" aria-label={t('confidence')} className="row grow" style={{ gap: 'var(--space-2)' }}>
            {CONFIDENCE.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={draft.confidence === c} className="pill" onClick={() => setDraft({ ...draft, confidence: c })}>
                {t(c)}
              </button>
            ))}
          </div>
          <Button variant="primary" disabled={!ready || busy} onClick={() => void submit(item)}>{t('submit')}</Button>
        </div>
      </main>
    </>
  );
}
