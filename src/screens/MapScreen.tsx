import { useState } from 'react';
import { filterRows, levelProgress } from '../app/map';
import type { Content } from '../content/load';
import type { MapLayer, MapLayerId, MapLevelId } from '../core/schema';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { Rich } from '../ui/components';

const TRACKS = ['rn', 'ios', 'android'] as const;
const TRACK_LABEL: Record<(typeof TRACKS)[number], UiKey> = { rn: 'track_rn', ios: 'track_ios', android: 'track_android' };

function LayerBox({ layer }: { layer: MapLayer }) {
  const { pick } = useLang();
  return (
    <div className={`km-layer km-layer-${layer.id}`}>
      <strong>{pick(layer.title)}</strong>
      <span className="muted"><Rich text={pick(layer.body)} /></span>
      {layer.parts.length > 0 ? (
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {layer.parts.map((p, i) => (
            <span key={i} className="chip num">{pick(p)}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MapScreen({ content, checked, onChecked }: {
  content: Content;
  checked: string[];
  onChecked: (id: string) => void;
}) {
  const { lang, t, pick } = useLang();
  const { map } = content;
  const [query, setQuery] = useState('');
  const [levelId, setLevelId] = useState<MapLevelId>('junior');
  const ticked = new Set(checked);
  const rows = filterRows(map.rows, query, lang);
  const level = map.levels.find((l) => l.id === levelId) ?? map.levels[0];
  const layer = (id: MapLayerId) => map.layers.find((l) => l.id === id);
  const stacked = [layer('js'), layer('runtime')].flatMap((l) => (l ? [l] : []));
  const native = [layer('ios'), layer('android')].flatMap((l) => (l ? [l] : []));

  return (
    <main className="page narrow stack" style={{ gap: 'var(--space-5)' }}>
      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <h1 className="display">{t('kmTitle')}</h1>
        <p className="lead">{t('kmSub')}</p>
      </div>

      <section className="stack">
        <h2 className="title">{t('kmLayersTitle')}</h2>
        <p className="lead">{t('kmLayersSub')}</p>
        <div className="km-layers">
          {stacked.map((l) => (
            <LayerBox key={l.id} layer={l} />
          ))}
          {native.length > 0 ? (
            <div className="km-native">
              {native.map((l) => (
                <LayerBox key={l.id} layer={l} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="stack">
        <h2 className="title">{t('kmRowsTitle')}</h2>
        <p className="lead">{t('kmRowsSub')}</p>
        <div className="row">
          <input
            type="search"
            className="km-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('kmSearch')}
            aria-label={t('kmSearch')}
          />
          <span className="num muted" aria-live="polite">{t('kmRowsCount', { n: rows.length, total: map.rows.length })}</span>
        </div>
        <div className="km-scroll">
          <table className="km-table">
            <thead>
              <tr>
                <th>{t('kmConcept')}</th>
                {TRACKS.map((x) => (
                  <th key={x}>{t(TRACK_LABEL[x])}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">{t('kmNoMatch', { q: query.trim() })}</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.concept.en}>
                    <td>{pick(r.concept)}</td>
                    {TRACKS.map((x) => (
                      <td key={x} className="num">{r[x]}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {level ? (
        <section className="stack">
          <h2 className="title">{t('kmLevelsTitle')}</h2>
          <div role="radiogroup" aria-label={t('roadmapLevel')} className="row" style={{ gap: 'var(--space-2)' }}>
            {map.levels.map((l) => {
              const p = levelProgress(l, ticked);
              return (
                <button key={l.id} type="button" role="radio" aria-checked={level.id === l.id} className="pill" onClick={() => setLevelId(l.id)}>
                  {pick(l.name)} <span className="num muted">{p.done}/{p.total}</span>
                </button>
              );
            })}
          </div>
          <div className="panel stack">
            <p className="lead">{pick(level.tag)}</p>
            <div className="km-cols">
              {TRACKS.map((x) => (
                <div key={x} className="stack" style={{ gap: 'var(--space-2)' }}>
                  <span className="label">{t(TRACK_LABEL[x])}</span>
                  <ul className="km-list">
                    {level[x].map((item, i) => (
                      <li key={i}><Rich text={pick(item)} /></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <span className="label">{t('kmChecksTitle')}</span>
            {level.checks.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={ticked.has(c.id)} onChange={() => onChecked(c.id)} />
                <span><Rich text={pick(c.text)} /></span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      <section className="stack">
        <h2 className="title">{t('kmArchTitle')}</h2>
        <p className="lead">{t('kmArchSub')}</p>
        <div className="km-scroll">
          <table className="km-table">
            <thead>
              <tr>
                <th>{t('kmOld')}</th>
                <th>{t('kmNew')}</th>
                <th>{t('kmChange')}</th>
              </tr>
            </thead>
            <tbody>
              {map.arch.map((a, i) => (
                <tr key={i}>
                  <td className="num">{a.old}</td>
                  <td className="num">{a.new}</td>
                  <td><Rich text={pick(a.change)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <h2 className="title">{t('kmTraceTitle')}</h2>
        <p className="lead">{t('kmTraceSub')}</p>
        <ol className="km-trace">
          {map.trace.map((s, i) => (
            <li key={i}>
              <span><Rich text={pick(s.step)} /></span>
              <span className="num muted">{s.where}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="stack">
        <h2 className="title">{t('kmHabitsTitle')}</h2>
        <div className="km-habits">
          {map.habits.map((h, i) => (
            <div key={i} className="card stack" style={{ gap: 'var(--space-2)' }}>
              <h3 className="km-h3">{pick(h.title)}</h3>
              <p style={{ margin: 0 }}><Rich text={pick(h.body)} /></p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
