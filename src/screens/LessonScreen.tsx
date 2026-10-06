import { useState } from 'react';
import { href, navigate } from '../app/router';
import type { SessionService } from '../app/sessionService';
import { splitTitle } from '../content/labs';
import type { Content } from '../content/load';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { NotFound } from '../ui/Chrome';
import { Button, Rich } from '../ui/components';
import { Markdown } from '../ui/Markdown';

export function LessonScreen({ service, content, lessonId }: { service: SessionService; content: Content; lessonId: string }) {
  const { t, pick } = useLang();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const lesson = content.lessons.find((l) => l.id === lessonId);
  if (!lesson) return <NotFound />;

  const topicId = lesson.topic;
  const topic = content.topics.find((x) => x.id === topicId);
  const hasItems = content.items.some((i) => i.topics[0] === topicId);
  const { title, rest } = splitTitle(pick(lesson.body));

  const practise = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const session = await service.startTopicPractice(topicId, Date.now());
      navigate({ name: 'test', sessionId: session.id });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <main className="page narrow stack" style={{ gap: 'var(--space-4)' }}>
      <a href={href({ name: 'library' })}>{t('backLibrary')}</a>
      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <span className="label">{t(`kind_${lesson.kind}` as UiKey)} · {t('minutes', { m: lesson.readMinutes })}</span>
        <h1 className="display"><Rich text={title ?? (topic ? pick(topic.title) : topicId)} /></h1>
      </div>
      <Markdown source={rest} />
      {hasItems ? (
        <div className="row">
          <Button variant="primary" disabled={busy} onClick={() => void practise()}>{t('practiseTopic')}</Button>
        </div>
      ) : null}
      {failed ? <p role="alert" className="muted down">{t('saveFailed')}</p> : null}
    </main>
  );
}
