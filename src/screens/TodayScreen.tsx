import { useEffect, useState } from 'react';
import { misconceptionText } from '../app/report';
import { href, navigate } from '../app/router';
import type { Overview, SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import { levelOf } from '../core/mastery';
import type { Duration } from '../core/sessionBuilder';
import { useLang } from '../i18n/LangProvider';
import { Button, MasteryBar, Rich } from '../ui/components';
import { formatScore } from '../ui/format';

const DURATIONS: Duration[] = [15, 30, 45];
const MIX_KEY = { 15: 'mix15', 30: 'mix30', 45: 'mix45' } as const;

export function TodayScreen({ service, content }: { service: SessionService; content: Content }) {
  const { lang, t, pick } = useLang();
  const [duration, setDuration] = useState<Duration>(30);
  const [overview, setOverview] = useState<Overview>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    service.overview(duration, Date.now()).then(
      (o) => {
        if (live) setOverview(o);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [service, duration]);

  const byId = new Map(content.items.map((i) => [i.id, i]));
  const daily = overview?.daily;
  // An unfinished Daily is what the main button resumes, so describe that session, not a new plan.
  const resuming = daily && !daily.finishedAt ? daily : undefined;
  const shownDuration = resuming ? resuming.durationMin : duration;
  const planItems = (resuming ? resuming.itemIds : (overview?.plan.itemIds ?? [])).flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const quick = planItems.filter((i) => i.type === 'mcq' || i.type === 'spot-bug').length;
  const opens = planItems.filter((i) => i.type === 'open').length;
  const challenges = planItems.filter((i) => i.type === 'challenge').length;
  const minutes = Math.round(planItems.reduce((s, i) => s + i.estSeconds, 0) / 60);
  const topicTitle = (id: string) => {
    const topic = content.topics.find((x) => x.id === id);
    return topic ? pick(topic.title) : id;
  };

  async function start() {
    setBusy(true);
    setFailed(false);
    try {
      const session = await service.start(duration, Date.now());
      navigate({ name: 'test', sessionId: session.id });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <main className="page today">
      <section className="stack" style={{ gap: 'var(--space-5)' }}>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <span className="label">
            {new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'numeric' })}
          </span>
          <h1 className="display">{t('todayTitle')}</h1>
          <p className="lead">{t('todaySub')}</p>
        </div>

        <div role="radiogroup" aria-label={t('durationGroup')} className="durations">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === shownDuration}
              disabled={resuming !== undefined}
              className="duration"
              onClick={() => {
                setDuration(d);
                setOverview(undefined);
              }}
            >
              <span className="numeral">{d}'</span>
              <span className="muted">{t(MIX_KEY[d])}</span>
            </button>
          ))}
        </div>

        <div className="panel stack">
          <span className="label">{t('includes', { d: shownDuration })}</span>
          <div className="counts">
            <div className="stack" style={{ gap: 2 }}>
              <span className="count">{quick}</span>
              <span className="muted">{t('countQuick')}</span>
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <span className="count">{opens}</span>
              <span className="muted">{t('countOpen')}</span>
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <span className="count">{challenges}</span>
              <span className="muted">{t('countChallenge')}</span>
            </div>
          </div>
        </div>

        {overview && planItems.length === 0 ? <p className="muted">{t(daily ? 'allDoneToday' : 'emptyBank')}</p> : null}
        {failed ? <p role="alert" className="muted down">{t('saveFailed')}</p> : null}

        <div className="row">
          {daily && !daily.finishedAt ? (
            <a className="btn btn-primary" href={href({ name: 'test', sessionId: daily.id })}>{t('resume')}</a>
          ) : (
            <Button variant="primary" disabled={busy || planItems.length === 0} onClick={() => void start()}>
              {t(daily ? 'startPractice' : 'start', { d: duration })}
            </Button>
          )}
          {daily?.finishedAt ? <a href={href({ name: 'result', sessionId: daily.id })}>{t('viewResult')}</a> : null}
          <span className="muted">{t('estimate', { m: minutes })}</span>
        </div>
      </section>

      <aside className="stack" style={{ gap: 'var(--space-4)' }}>
        <div className="card stack">
          <span className="label">{t('weakNow')}</span>
          {overview && overview.gaps.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('noGaps')}</p> : null}
          {overview?.gaps.map((g) => (
            <div key={g.topicId} className="stack" style={{ gap: 6 }}>
              <div className="row between">
                <span>{topicTitle(g.topicId)}</span>
                <span className="num">{formatScore(g.mastery)}</span>
              </div>
              {/* a gap always has enough attempts, so only the value decides its level */}
              <MasteryBar value={g.mastery} level={levelOf(g.mastery, Number.MAX_SAFE_INTEGER)} />
            </div>
          ))}
        </div>

        {overview && overview.misconceptions.length > 0 ? (
          <div className="panel stack">
            <span className="label">{t('recentMisconceptions')}</span>
            {overview.misconceptions.slice(0, 3).map((m) => {
              const text = misconceptionText(content, m.id);
              return (
                <div key={m.id} className="stack" style={{ gap: 2 }}>
                  <span><Rich text={text ? pick(text) : m.id} /></span>
                  <span className="num muted">{t('seenTimes', { n: m.occurrences })}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </aside>
    </main>
  );
}
