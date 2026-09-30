import { useState } from 'react';
import { toggleIn } from '../../app/draft';
import type { Localized, Open } from '../../core/schema';
import { useLang } from '../../i18n/LangProvider';
import { Button, Rich } from '../../ui/components';

export function OpenView({ item, hits, revealed, onReveal, onHits, text }: {
  item: Open;
  hits: number[];
  revealed: boolean;
  onReveal: () => void;
  onHits: (hits: number[]) => void;
  text: (l: Localized) => string;
}) {
  const { t } = useLang();
  const [answer, setAnswer] = useState('');
  return (
    <div className="stack">
      <label className="stack" style={{ gap: 'var(--space-2)' }} htmlFor={`answer-${item.id}`}>
        <span className="muted">{t('yourAnswer')}</span>
        <textarea id={`answer-${item.id}`} className="answer-box" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </label>
      {!revealed ? (
        <Button onClick={onReveal}>{t('reveal')}</Button>
      ) : (
        <div className="card stack">
          <span className="label">{t('modelAnswer')}</span>
          <p style={{ margin: 0 }}><Rich text={text(item.modelAnswer)} /></p>
          <span className="label">{t('tickPoints')}</span>
          {item.keyPoints.map((k, i) => (
            <label key={i} className="check">
              <input type="checkbox" checked={hits.includes(i)} onChange={() => onHits(toggleIn(hits, i))} />
              <span><Rich text={text(k)} /></span>
            </label>
          ))}
          {item.followUps.length > 0 ? (
            <>
              <span className="label">{t('followUps')}</span>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {item.followUps.map((f, i) => (
                  <li key={i}><Rich text={text(f)} /></li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
