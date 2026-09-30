import type { Localized, SpotBug } from '../../core/schema';
import { useLang } from '../../i18n/LangProvider';
import { Rich } from '../../ui/components';

export function SpotBugView({ item, line, cause, onChange, text }: {
  item: SpotBug;
  line: number | null;
  cause: number | null;
  onChange: (value: { line: number | null; cause: number | null }) => void;
  text: (l: Localized) => string;
}) {
  const { t } = useLang();
  return (
    <div className="stack">
      <span className="muted">{t('pickLine')}</span>
      <div role="group" aria-label={t('pickLine')} className="code-block">
        {item.code.split('\n').map((src, i) => (
          <button key={i} type="button" className="code-line" aria-pressed={line === i + 1} onClick={() => onChange({ line: i + 1, cause })}>
            <span className="ln">{i + 1}</span>
            <span>{src || ' '}</span>
          </button>
        ))}
      </div>
      <span className="muted">{t('pickCause')}</span>
      <div role="group" aria-label={t('pickCause')} className="options">
        {item.causeOptions.map((o, i) => (
          <button key={i} type="button" className="option" aria-pressed={cause === i} onClick={() => onChange({ line, cause: i })}>
            <span className="num option-key">{String.fromCharCode(65 + i)}</span>
            <span><Rich text={text(o.text)} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}
