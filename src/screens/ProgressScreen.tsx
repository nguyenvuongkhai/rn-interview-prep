import { useEffect, useState } from 'react';
import { localDate } from '../app/dates';
import { streak, topicGroups, weeklyScores } from '../app/progress';
import type { SessionService, Stats } from '../app/sessionService';
import type { Content } from '../content/load';
import type { Level } from '../core/mastery';
import { useLang } from '../i18n/LangProvider';
import { MasteryBar, Stat } from '../ui/components';
import { formatScore } from '../ui/format';

const CELL: Record<Level, string> = { insufficient: 'cell-none', weak: 'cell-weak', learning: 'cell-learning', solid: 'cell-solid' };

export function ProgressScreen({ service, content }: { service: SessionService; content: Content }) {
  const { t, pick } = useLang();
  const [stats, setStats] = useState<Stats | null>();

  useEffect(() => {
    let live = true;
    service.stats(Date.now()).then(
      (s) => {
        if (live) setStats(s);
      },
      () => {
        if (live) setStats(null);
      },
    );
    return () => {
      live = false;
    };
  }, [service]);

  if (stats === undefined) return <p className="page muted">{t('loading')}</p>;
  if (stats === null) return <p role="alert" className="page muted down">{t('loadFailed')}</p>;

  const now = Date.now();
  const groups = topicGroups(content.topics, stats.mastery);
  const weeks = weeklyScores(stats.attempts, now);
  const last = weeks[weeks.length - 1];
  const days = streak(stats.sessions, localDate(now));

  return (
    <main className="page stack" style={{ gap: 'var(--space-5)' }}>
      <div className="row between">
        <h1 className="display">{t('progressTitle')}</h1>
        <div className="row" style={{ gap: 'var(--space-5)' }}>
          <Stat value={String(days)} label={t('streakLabel')} />
          <Stat value={String(stats.attempts.length)} label={t('answersLabel')} />
        </div>
      </div>

      <div className="progress">
        <section className="stack">
          <h2 className="title">{t('readiness')}</h2>
          {groups.map((g) => {
            const value = g.mastery && g.mastery.level !== 'insufficient' ? g.mastery.value : null;
            return (
              <div key={g.root.id} className="stack" style={{ gap: 6 }}>
                <div className="row between">
                  <span>{pick(g.root.title)}</span>
                  {value !== null ? <span className="num">{formatScore(value)}</span> : <span className="muted">{t('notEnough')}</span>}
                </div>
                <MasteryBar value={g.mastery?.value ?? null} level={g.mastery?.level ?? 'insufficient'} />
              </div>
            );
          })}

          <div className="card stack">
            <span className="label">{t('weeklyTitle', { n: weeks.length })}</span>
            <div className="week-chart">
              {weeks.map((w, i) => (
                <div
                  key={w.start}
                  className={w.mean === null ? 'week-bar empty' : i === weeks.length - 1 ? 'week-bar current' : 'week-bar'}
                  style={{ height: `${Math.max(4, Math.round((w.mean ?? 0) * 100))}%` }}
                  title={w.mean === null ? t('notEnough') : formatScore(w.mean)}
                />
              ))}
            </div>
            <div className="row between num muted">
              <span>{t('weekLabel', { n: 1 })}</span>
              <span>
                {t('weekLabel', { n: weeks.length })}
                {last.mean !== null ? ` · ${formatScore(last.mean)}` : ''}
              </span>
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="row between">
            <h2 className="title">{t('mapTitle')}</h2>
            <div className="legend">
              <span><span className="swatch cell-none" />{t('legendNone')}</span>
              <span><span className="swatch cell-weak" />{t('legendWeak')}</span>
              <span><span className="swatch cell-learning" />{t('legendLearning')}</span>
              <span><span className="swatch cell-solid" />{t('legendSolid')}</span>
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.root.id} className="stack" style={{ gap: 6 }}>
              <span className="label">{pick(g.root.title)}</span>
              <div className="map-grid">
                {g.leaves.map(({ topic, mastery }) => {
                  const level = mastery?.level ?? 'insufficient';
                  const value = mastery && level !== 'insufficient' ? mastery.value : null;
                  return (
                    <div key={topic.id} className={`cell ${CELL[level]}`}>
                      <span>{pick(topic.title)}</span>
                      <span className="num">{value !== null ? formatScore(value) : t('attemptsCount', { n: mastery?.count ?? 0 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
