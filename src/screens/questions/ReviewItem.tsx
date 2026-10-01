import { useEffect, useState } from 'react';
import type { SessionService } from '../../app/sessionService';
import type { Content } from '../../content/load';
import type { Item, Option } from '../../core/schema';
import type { Attempt } from '../../core/types';
import { useLang } from '../../i18n/LangProvider';
import { Rich } from '../../ui/components';

/** A wrong answer replayed with its answer key: the code, every option, and what the user picked. */
export function ReviewItem({ item, attempt, content, service }: { item: Item; attempt: Attempt; content: Content; service: SessionService }) {
  const { t, pick } = useLang();
  const picked = attempt.picked;

  const options = (list: Option[], correct: number[], chosen: number[] | undefined) => (
    <div className="review-options">
      {list.map((o, i) => {
        const isCorrect = correct.includes(i);
        const isChosen = chosen?.includes(i) ?? false;
        const tone = isCorrect ? 'correct' : isChosen ? 'chosen-wrong' : '';
        return (
          <div key={i} className={`review-option ${tone}`.trim()}>
            <span className="num option-key">{String.fromCharCode(65 + i)}</span>
            <div className="stack" style={{ gap: 2 }}>
              <span><Rich text={pick(o.text)} /></span>
              {isCorrect || isChosen ? (
                <span className={isCorrect ? 'label up' : 'label down'}>
                  {[isCorrect ? t('correctAnswer') : null, isChosen ? t('yourPick') : null].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {isChosen && !isCorrect && o.misconception ? (
                <span className="muted"><Rich text={pick(o.misconception.text)} /></span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  switch (item.type) {
    case 'mcq':
      return (
        <div className="stack review">
          {options(item.options, item.answer, picked?.selected)}
          <p className="muted"><Rich text={pick(item.explanation)} /></p>
        </div>
      );
    case 'spot-bug':
      return (
        <div className="stack review">
          <span className="muted">
            {t('bugLine', { n: item.answerLine })}
            {picked?.line !== undefined && picked.line !== item.answerLine ? ` · ${t('yourLine', { n: picked.line })}` : ''}
          </span>
          <div className="code-static">
            {item.code.split('\n').map((src, i) => {
              const n = i + 1;
              const tone = n === item.answerLine ? 'answer' : n === picked?.line ? 'chosen-wrong' : '';
              return (
                <div key={i} className={`code-row ${tone}`.trim()}>
                  <span className="ln">{n}</span>
                  <span>{src || ' '}</span>
                </div>
              );
            })}
          </div>
          {options(item.causeOptions, [item.answerCause], picked?.cause !== undefined ? [picked.cause] : undefined)}
          <p className="muted"><Rich text={pick(item.explanation)} /></p>
        </div>
      );
    case 'open':
      return (
        <div className="stack review">
          <span className="label">{t('keyPointsTitle')}</span>
          <ul className="test-list">
            {item.keyPoints.map((k, i) => {
              const hit = picked?.hitKeyPoints?.includes(i) ?? false;
              return (
                <li key={i}>
                  <span className={hit ? 'up' : 'down'}>{hit ? '✓' : '✗'}</span> <Rich text={pick(k)} />
                </li>
              );
            })}
          </ul>
          <span className="label">{t('modelAnswer')}</span>
          <p className="muted"><Rich text={pick(item.modelAnswer)} /></p>
        </div>
      );
    case 'challenge':
      return <ChallengeReview id={item.id} content={content} service={service} />;
  }
}

function ChallengeReview({ id, content, service }: { id: string; content: Content; service: SessionService }) {
  const { t } = useLang();
  const [code, setCode] = useState<string>();
  const files = content.challenges[id];

  useEffect(() => {
    let live = true;
    service.loadDraft(id).then(
      (saved) => {
        if (live) setCode(saved);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [service, id]);

  return (
    <div className="stack review">
      {code !== undefined ? (
        <>
          <span className="label">{t('yourCode')}</span>
          <pre className="md-code">{code}</pre>
        </>
      ) : null}
      {files ? (
        <>
          <span className="label">{t('solutionTitle')}</span>
          <pre className="md-code">{files.solution}</pre>
        </>
      ) : null}
    </div>
  );
}
