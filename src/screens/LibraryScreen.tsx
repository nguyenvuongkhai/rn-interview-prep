import { useEffect, useState } from 'react';
import { topicGroups } from '../app/progress';
import { href, navigate } from '../app/router';
import type { SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import type { Mastery } from '../core/mastery';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { Button, MasteryBar } from '../ui/components';
import { formatScore } from '../ui/format';

export function LibraryScreen({ service, content }: { service: SessionService; content: Content }) {
  const { t, pick } = useLang();
  const [mastery, setMastery] = useState<Map<string, Mastery>>(() => new Map());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let live = true;
    service.stats(Date.now()).then(
      (stats) => {
        if (live) setMastery(stats.mastery);
      },
      () => {
        if (live) setLoadFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [service]);

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
      <h1 className="display">{t('libraryTitle')}</h1>
      {failed ? <p role="alert" className="muted down">{t('saveFailed')}</p> : null}
      {loadFailed ? <p role="alert" className="muted down">{t('loadFailed')}</p> : null}
      {topicGroups(content.topics, mastery).map((group) => (
        <section key={group.root.id} className="stack">
          <h2 className="title">{pick(group.root.title)}</h2>
          <div className="topics">
            {group.leaves.map(({ topic, mastery: m }) => {
              const items = content.items.filter((i) => i.topics[0] === topic.id);
              const challenges = items.filter((i) => i.type === 'challenge').length;
              const lessons = content.lessons.filter((l) => l.topic === topic.id);
              const known = m !== undefined && m.value !== null && m.level !== 'insufficient';
              return (
                <article key={topic.id} className="panel stack" style={{ gap: 'var(--space-2)' }}>
                  <div className="row between">
                    <span style={{ fontWeight: 600 }}>{pick(topic.title)}</span>
                    <span className="num muted">{known && m.value !== null ? formatScore(m.value) : t('notEnough')}</span>
                  </div>
                  <MasteryBar value={m?.value ?? null} level={m?.level ?? 'insufficient'} />
                  <span className="muted">{t('itemCount', { q: items.length - challenges, c: challenges })}</span>
                  {lessons.map((l) => (
                    <a key={l.id} href={href({ name: 'lesson', lessonId: l.id })}>
                      {t('lessonLink', { kind: t(`kind_${l.kind}` as UiKey), m: l.readMinutes })}
                    </a>
                  ))}
                  {items.length > 0 ? (
                    <Button className="btn-small" disabled={busy} onClick={() => void practise(topic.id)}>{t('practiseTopic')}</Button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
