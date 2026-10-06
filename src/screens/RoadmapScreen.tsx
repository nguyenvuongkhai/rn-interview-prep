import { useState } from 'react';
import { href, navigate } from '../app/router';
import { roadmapView } from '../app/roadmap';
import type { SessionService } from '../app/sessionService';
import { splitTitle } from '../content/labs';
import type { Content } from '../content/load';
import type { RoadmapLevel, RoadmapTrack } from '../core/schema';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { Button, MasteryBar, Rich } from '../ui/components';

const TRACKS: RoadmapTrack[] = ['rn', 'ios', 'android'];
const LEVELS: RoadmapLevel[] = ['middle', 'senior'];
const TRACK_LABEL: Record<RoadmapTrack, UiKey> = { rn: 'track_rn', ios: 'track_ios', android: 'track_android' };
const LEVEL_LABEL: Record<RoadmapLevel, UiKey> = { middle: 'level_middle', senior: 'level_senior' };

export function RoadmapScreen({ service, content, checked, onChecked }: {
  service: SessionService;
  content: Content;
  checked: string[];
  onChecked: (id: string) => void;
}) {
  const { t, pick } = useLang();
  const [track, setTrack] = useState<RoadmapTrack>('rn');
  const [level, setLevel] = useState<RoadmapLevel>('middle');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const view = roadmapView(content.roadmap.areas, content.roadmap.items, track, level, new Set(checked));
  const topicTitle = (id: string) => {
    const topic = content.topics.find((x) => x.id === id);
    return topic ? pick(topic.title) : id;
  };

  async function practise(topicId: string) {
    setBusy(true);
    setFailed(false);
    try {
      const session = await service.startTopicPractice(topicId, Date.now());
      navigate({ name: 'test', sessionId: session.id });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <main className="page stack" style={{ gap: 'var(--space-5)' }}>
      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <h1 className="display">{t('roadmapTitle')}</h1>
        <p className="lead">{t('roadmapSub')}</p>
      </div>

      <div className="row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div role="radiogroup" aria-label={t('roadmapTrack')} className="row" style={{ gap: 'var(--space-2)' }}>
          {TRACKS.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={track === x} className="pill" onClick={() => setTrack(x)}>
              {t(TRACK_LABEL[x])}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={t('roadmapLevel')} className="row" style={{ gap: 'var(--space-2)' }}>
          {LEVELS.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={level === x} className="pill" onClick={() => setLevel(x)}>
              {t(LEVEL_LABEL[x])}
            </button>
          ))}
        </div>
      </div>

      {view.total === 0 ? (
        <p className="muted">{t('roadmapEmpty')}</p>
      ) : (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <span className="num muted">{t('roadmapProgress', { done: view.done, total: view.total })}</span>
          <MasteryBar value={view.done / view.total} level="solid" />
        </div>
      )}
      {failed ? <p role="alert" className="muted down">{t('saveFailed')}</p> : null}

      {view.groups.map(({ area, items }) => (
        <section key={area.id} className="stack">
          <h2 className="title">{pick(area.title)}</h2>
          {items.map((item) => {
            const lessons = item.lessons.flatMap((id) => {
              const lesson = content.lessons.find((l) => l.id === id);
              return lesson ? [lesson] : [];
            });
            const practisable = item.topics.filter((id) => content.items.some((i) => i.topics[0] === id));
            return (
              <article key={item.id} className="panel stack" style={{ gap: 'var(--space-2)' }}>
                <label className="check">
                  <input type="checkbox" checked={checked.includes(item.id)} onChange={() => onChecked(item.id)} aria-label={`${t('markKnown')}: ${pick(item.title)}`} />
                  <span style={{ fontWeight: 600 }}><Rich text={pick(item.title)} /></span>
                </label>
                <span className="label">{t('mustKnow')}</span>
                <p style={{ margin: 0 }}><Rich text={pick(item.know)} /></p>
                <span className="label">{t('checkYourself')}</span>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {item.check.map((c, i) => (
                    <li key={i}><Rich text={pick(c)} /></li>
                  ))}
                </ul>
                <span className="label">{t('practiceHere')}</span>
                {lessons.length === 0 && practisable.length === 0 ? <span className="muted">{t('noPractice')}</span> : null}
                <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {lessons.map((l) => (
                    <a key={l.id} href={href({ name: 'lesson', lessonId: l.id })}>
                      {splitTitle(pick(l.body)).title ?? `${topicTitle(l.topic)} · ${t(`kind_${l.kind}` as UiKey)}`}
                    </a>
                  ))}
                  {practisable.map((id) => (
                    <Button key={id} className="btn-small" disabled={busy} onClick={() => void practise(id)}>
                      {topicTitle(id)}
                    </Button>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </main>
  );
}
