import { toggleIn } from '../../app/draft';
import type { Localized, Mcq } from '../../core/schema';
import { useLang } from '../../i18n/LangProvider';
import { Rich } from '../../ui/components';

export function McqView({ item, selected, onChange, text }: {
  item: Mcq;
  selected: number[];
  onChange: (selected: number[]) => void;
  text: (l: Localized) => string;
}) {
  const { t } = useLang();
  return (
    <div role="group" aria-label={t('answers')} className="options">
      {item.options.map((o, i) => (
        <button key={i} type="button" className="option" aria-pressed={selected.includes(i)} onClick={() => onChange(item.multi ? toggleIn(selected, i) : [i])}>
          <span className="num option-key">{String.fromCharCode(65 + i)}</span>
          <span><Rich text={text(o.text)} /></span>
        </button>
      ))}
    </div>
  );
}
