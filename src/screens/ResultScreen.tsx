import { useEffect, useState } from 'react';
import { buildReport, misconceptionText, type SessionReport } from '../app/report';
import { href, navigate } from '../app/router';
import type { SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import type { Diagnosis, PlanStep } from '../core/recommend';
import { useLang } from '../i18n/LangProvider';
import { NotFound } from '../ui/Chrome';
import { Button, Rich, Stat } from '../ui/components';
import { formatClock, formatScore } from '../ui/format';
import { ReviewItem } from './questions/ReviewItem';

function Delta({ before, after }: { before: number | null; after: number | null }) {
  if (after === null) return null;
  const up = before === null || after >= before;
  return (
    <span className={up ? 'num up' : 'num down'}>
      {up ? '▲' : '▼'} {before === null ? '–' : formatScore(before)} → {formatScore(after)}
    </span>
  );
}

export function ResultScreen({ service, content, sessionId }: { service: SessionService; content: Content; sessionId: string }) {
  const { t, pick } = useLang();
  const [report, setReport] = useState<SessionReport | null>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([service.load(sessionId), service.listAttempts()]).then(([loaded, all]) => {
      if (live) setReport(loaded ? buildReport(content, all, sessionId, Date.now()) : null);
    });
    return () => {
      live = false;
    };
  }, [service, content, sessionId]);

  if (report === undefined) return <p className="page muted">{t('loading')}</p>;
  if (report === null) return <NotFound />;

  const byId = new Map(content.items.map((i) => [i.id, i]));
  const topicTitle = (id: string) => {
    const topic = content.topics.find((x) => x.id === id);
    return topic ? pick(topic.title) : id;
  };
  const describe = (d: Diagnosis | undefined): string | null => {
    if (!d) return null;
    switch (d.code) {
      case 'lacks-practice':
        return t('diag_lacks-practice', { core: formatScore(d.core), practice: formatScore(d.practice) });
      case 'cant-explain':
        return t('diag_cant-explain', { recognise: formatScore(d.recognise), explain: formatScore(d.explain) });
      case 'shaky':
        return t('diag_shaky', { pct: Math.round(d.guessRatio * 100) });
      default:
        return null;
    }
  };
  const stepText = (s: PlanStep): string => {
    if (s.kind === 'read') return t('stepRead');
    if (s.kind === 'practice') return t('stepPractice', { n: s.itemIds.length });
    const ch = byId.get(s.itemId);
    return t('stepChallenge', { title: ch?.type === 'challenge' ? pick(ch.title) : s.itemId });
  };
  const misconceptions = report.diagnoses.flatMap((d) => (d.code === 'misconception' ? [d] : []));
  const categories = report.diagnoses.flatMap((d) => (d.code === 'challenge-category' ? [d] : []));

  async function practise(itemIds: string[]) {
    setBusy(true);
    setFailed(false);
    try {
      const session = await service.startPractice(itemIds, Date.now());
      navigate({ name: 'test', sessionId: session.id });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <main className="page stack" style={{ gap: 'var(--space-5)' }}>
      <section className="summary">
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          <span className="label">{t('resultEyebrow')}</span>
          <span className="score">{formatScore(report.score)}</span>
        </div>
        <div className="row grow" style={{ gap: 'var(--space-5)' }}>
          <Stat value={`${report.correct} / ${report.total}`} label={t('correctCount')} />
          <Stat value={formatClock(report.timeSpentSec)} label={t('timeSpent')} />
          <Stat value={String(report.guessedCorrect)} label={t('guessed')} />
        </div>
        <div className="stack" style={{ gap: 6 }}>
          {report.deltas.map((d) => (
            <span key={d.topicId}>
              {topicTitle(d.topicId)} <Delta before={d.before} after={d.after} />
            </span>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="title">{t('gapsTitle')}</h2>
        {failed ? <p role="alert" className="muted down">{t('saveFailed')}</p> : null}
        {report.gaps.length === 0 ? <p className="muted">{t('noGaps')}</p> : null}
        <div className="gaps">
          {report.gaps.map((g, index) => {
            const diagnosis = describe(report.diagnoses.find((d) => 'topicId' in d && d.topicId === g.topicId));
            const practice = g.plan.find((s): s is Extract<PlanStep, { kind: 'practice' }> => s.kind === 'practice');
            return (
              <article key={g.topicId} className={index === 0 ? 'card stack' : 'panel stack'}>
                <div className="row between">
                  <span style={{ fontWeight: 600 }}>{topicTitle(g.topicId)}</span>
                  <span className="num">{formatScore(g.mastery)}</span>
                </div>
                {diagnosis ? <span className="muted">{diagnosis}</span> : null}
                <ol className="steps">
                  {g.plan.map((s) => (
                    <li key={s.kind}>
                      {s.kind === 'read' ? <a href={href({ name: 'lesson', lessonId: s.lessonId })}>{stepText(s)}</a> : stepText(s)}{' '}
                      <span className="num muted">{s.minutes}'</span>
                    </li>
                  ))}
                </ol>
                {practice ? (
                  <Button variant={index === 0 ? 'primary' : 'secondary'} disabled={busy} onClick={() => void practise(practice.itemIds)}>
                    {t('practiceNow', { m: practice.minutes })}
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="two">
        {misconceptions.length > 0 ? (
          <div className="callout stack" style={{ gap: 'var(--space-2)' }}>
            <span className="label">{t('misconceptionTitle')}</span>
            {misconceptions.slice(0, 3).map((m) => {
              const text = misconceptionText(content, m.misconceptionId);
              return (
                <div key={m.misconceptionId} className="stack" style={{ gap: 2 }}>
                  <span><Rich text={text ? pick(text) : m.misconceptionId} /></span>
                  <span className="num muted">{t('pickedTimes', { n: m.occurrences })}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        {categories.length > 0 ? (
          <div className="callout stack" style={{ gap: 'var(--space-2)' }}>
            <span className="label">{t('categoryTitle')}</span>
            {categories.map((c) => (
              <span key={c.category} className="num">{t('categoryLine', { category: c.category, n: c.failures })}</span>
            ))}
          </div>
        ) : null}
        <div className="panel stack" style={{ gap: 'var(--space-2)' }}>
          <span className="label">{t('wrongTitle')}</span>
          {report.wrong.length === 0 ? <span className="muted">{t('noneWrong')}</span> : null}
          {report.wrong.map(({ item, attempt }) => (
            <details key={attempt.id}>
              <summary>
                <span className="down">✗</span> {item.type === 'challenge' ? pick(item.title) : <Rich text={pick(item.prompt)} />}
              </summary>
              <ReviewItem item={item} attempt={attempt} content={content} service={service} />
            </details>
          ))}
        </div>
      </section>

      <a href={href({ name: 'today' })}>{t('backToday')}</a>
    </main>
  );
}
