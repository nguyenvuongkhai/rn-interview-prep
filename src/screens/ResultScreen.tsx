import { useEffect, useState } from 'react';
import { buildReport, misconceptionText, type SessionReport } from '../app/report';
import { href, navigate } from '../app/router';
import type { SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import type { Diagnosis, PlanStep } from '../core/recommend';
import { useLang } from '../i18n/LangProvider';
import { NotFound } from '../ui/Chrome';
import { Button, Rich } from '../ui/components';
import { formatClock, formatScore } from '../ui/format';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stack" style={{ gap: 0 }}>
      <span className="stat">{value}</span>
      <span className="muted">{label}</span>
    </div>
  );
}

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

  async function practise(itemIds: string[]) {
    setBusy(true);
    const session = await service.startPractice(itemIds, Date.now());
    navigate({ name: 'test', sessionId: session.id });
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
                      {stepText(s)} <span className="num muted">{s.minutes}'</span>
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
        <div className="panel stack" style={{ gap: 'var(--space-2)' }}>
          <span className="label">{t('wrongTitle')}</span>
          {report.wrong.length === 0 ? <span className="muted">{t('noneWrong')}</span> : null}
          {report.wrong.map(({ item }) => (
            <details key={item.id}>
              <summary>
                <span className="down">✗</span> {item.type === 'challenge' ? pick(item.title) : <Rich text={pick(item.prompt)} />}
              </summary>
              {'explanation' in item ? <p className="muted"><Rich text={pick(item.explanation)} /></p> : null}
              {item.type === 'open' ? <p className="muted"><Rich text={pick(item.modelAnswer)} /></p> : null}
            </details>
          ))}
        </div>
      </section>

      <a href={href({ name: 'today' })}>{t('backToday')}</a>
    </main>
  );
}
