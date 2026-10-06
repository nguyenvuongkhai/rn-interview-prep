import { href } from '../../app/router';
import { labsFor, splitTitle } from '../../content/labs';
import type { Content } from '../../content/load';
import { useLang } from '../../i18n/LangProvider';

/** "How to verify" links to the labs a question points at; nothing when it has none. */
export function VerifyLinks({ lessonIds, content }: { lessonIds: string[]; content: Content }) {
  const { t, pick } = useLang();
  const labs = labsFor(lessonIds, content.lessons);
  if (labs.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 'var(--space-1)' }}>
      {labs.map((l) => (
        <a key={l.id} href={href({ name: 'lesson', lessonId: l.id })}>
          {t('verifyLink', { title: splitTitle(pick(l.body)).title ?? l.id })}
        </a>
      ))}
    </div>
  );
}
