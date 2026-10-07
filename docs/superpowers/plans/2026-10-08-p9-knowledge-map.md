# P9 Knowledge Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Quy tắc của chủ project:**
> - **Không chạy build/test/dev server.** Mỗi task kết thúc bằng Checkpoint để Warren chạy.
> - Controller commit và push sau mỗi nhóm task, message 1 dòng `P9: …`.
> - Không cài package mới.

**Goal:** Màn Bản đồ (`#/map`) đưa trang `rn-knowledge-map.html` vào app: ba tầng của một app RN, bảng đối chiếu RN / iOS / Android có tìm kiếm, ba cấp độ có câu tự kiểm tra và ô tick, kiến trúc cũ và mới, đường đi từ cú chạm tới pixel, và năm thói quen.

**Spec:** `docs/superpowers/specs/2026-10-08-knowledge-map-design.md` (đã chốt với chủ project ngày 2026-10-08).

**Architecture:**
- **Nội dung:** một file `content/map/map.json`, song ngữ, kiểm tra bằng schema zod `mapFile` trong `src/core/schema.ts` và `checkMap` trong `src/content/integrity.ts`.
- **Loader:** `loadContent` nhận thêm `map` (tuỳ chọn). Thiếu file thì `content.map` là `EMPTY_MAP`.
- **Hàm thuần** `src/app/map.ts`: lọc bảng, đếm tiến độ một cấp. Ô tick dùng lại helper của `roadmap.ts`.
- **Ô tick:** lưu ở setting `map` (mảng id). `App.tsx` gộp logic tick của roadmap và map thành `toggleTicks`. Backup kiểm tra giá trị là mảng chuỗi.
- **Màn hình:** `MapScreen`, route `#/map`, tab "Bản đồ / Map" trên TopBar sau Lộ trình.

**Tech Stack:** React 19, TypeScript 5.9, zod 3, Vitest.

**Tên dễ trùng:**
- `mapTitle` trong `strings.ts` đã là "Bản đồ chủ đề" của màn Tiến độ. Chuỗi mới dùng key `map` cho tab và tiền tố `km` cho mọi key còn lại.
- `.map-grid` trong `app.css` đã có. Class mới dùng tiền tố `km-`.

---

## File structure

```
src/core/schema.ts                         # sửa: schema bản đồ
src/content/load.ts (+ test), index.ts, integrity.ts   # sửa
src/app/map.ts (+ test)                    # mới
src/app/backup.ts (+ test)                 # sửa: setting map
src/app/router.ts (+ test), src/ui/Chrome.tsx           # sửa: route map
src/app/report.test.ts, src/app/sessionService.test.ts  # sửa: fixture Content có thêm map
src/i18n/strings.ts                        # sửa
src/screens/MapScreen.tsx                  # mới
src/ui/app.css                             # sửa
src/App.tsx                                # sửa
content/map/map.json                       # mới (Task 2)
src/content/content.test.ts                # sửa (Task 3)
docs/content-guide.md                      # sửa (Task 3)
```

---

### Task 1: Code của Bản đồ

**Files:** như trên, trừ `content/map/map.json`, `content.test.ts` và `content-guide.md`.

- [ ] **Step 1: Schema.** Thêm vào `src/core/schema.ts`, ngay sau `export const roadmapFile = z.array(roadmapItem);`:

```ts
export const mapLayerId = z.enum(['js', 'runtime', 'ios', 'android']);
export const mapLevelId = z.enum(['junior', 'middle', 'senior']);
export const mapLayer = z.strictObject({
  id: mapLayerId,
  title: localized,
  body: localized,
  parts: z.array(localized).default([]),
});
/** one concept; the platform cells are API and tool names, so they are not translated */
export const mapRow = z.strictObject({
  concept: localized,
  rn: z.string().min(1),
  ios: z.string().min(1),
  android: z.string().min(1),
});
export const mapCheck = z.strictObject({ id, text: localized });
export const mapLevel = z.strictObject({
  id: mapLevelId,
  name: localized,
  tag: localized,
  rn: z.array(localized).min(1),
  ios: z.array(localized).min(1),
  android: z.array(localized).min(1),
  checks: z.array(mapCheck).length(4),
});
export const mapArch = z.strictObject({ old: z.string().min(1), new: z.string().min(1), change: localized });
export const mapStep = z.strictObject({ step: localized, where: z.string().min(1) });
export const mapHabit = z.strictObject({ title: localized, body: localized });
export const mapFile = z.strictObject({
  layers: z.array(mapLayer),
  rows: z.array(mapRow),
  levels: z.array(mapLevel),
  arch: z.array(mapArch),
  trace: z.array(mapStep),
  habits: z.array(mapHabit),
});
```

và thêm type ngay sau `export type RoadmapItem = z.infer<typeof roadmapItem>;`:

```ts
export type MapLayerId = z.infer<typeof mapLayerId>;
export type MapLevelId = z.infer<typeof mapLevelId>;
export type MapLayer = z.infer<typeof mapLayer>;
export type MapRow = z.infer<typeof mapRow>;
export type MapLevel = z.infer<typeof mapLevel>;
export type KnowledgeMap = z.infer<typeof mapFile>;
```

- [ ] **Step 2: Test cho loader.** Thêm vào cuối `describe('loadContent', …)` trong `src/content/load.test.ts`:

```ts
  const mapLevel = (id: string, checkIds: string[]) => ({
    id, name: L(id), tag: L('t'), rn: [L('a')], ios: [L('b')], android: [L('c')],
    checks: checkIds.map((c) => ({ id: c, text: L('q') })),
  });
  const checkIds = (level: string) => [1, 2, 3, 4].map((n) => `map-${level}-${n}`);
  const knowledgeMap = (levels: object[]) => ({
    layers: [{ id: 'js', title: L('JS'), body: L('b') }],
    rows: [{ concept: L('Text'), rn: '<Text>', ios: 'UILabel', android: 'TextView' }],
    levels, arch: [], trace: [], habits: [],
  });
  const goodMap = knowledgeMap([
    mapLevel('junior', checkIds('junior')),
    mapLevel('middle', checkIds('middle')),
    mapLevel('senior', checkIds('senior')),
  ]);

  it('loads the knowledge map', () => {
    const ok = loadContent(raw({ map: goodMap }));
    expect(ok.map.levels.map((l) => l.id)).toEqual(['junior', 'middle', 'senior']);
    expect(ok.map.layers[0].parts).toEqual([]);
  });

  it('reports map levels out of order and bad check ids', () => {
    const broken = knowledgeMap([
      mapLevel('middle', checkIds('middle')),
      mapLevel('junior', ['map-junior-1', 'map-junior-1', 'map-middle-9', 'map-junior-4']),
      mapLevel('senior', checkIds('senior')),
    ]);
    expect(issuesOf(raw({ map: broken }))).toEqual([
      'map levels must be junior, middle, senior in that order',
      'duplicate map check "map-junior-1"',
      'map check "map-middle-9": id must start with "map-junior-"',
    ]);
  });

  it('rejects a map file that breaks the schema', () => {
    const issues = issuesOf(raw({ map: { ...goodMap, rows: [{ concept: L('x'), rn: '', ios: 'a', android: 'b' }] } }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/^\/content\/map\/map\.json: rows\.0\.rn: /);
  });

  it('treats a missing map as empty', () => {
    expect(loadContent(raw()).map).toEqual(EMPTY_MAP);
  });
```

Đổi dòng import thứ hai của file thành:

```ts
import { ContentError, EMPTY_MAP, loadContent, type RawContent } from './load';
```

- [ ] **Step 3: Kiểm tra chéo.** Thêm vào cuối `src/content/integrity.ts`:

```ts
const MAP_LEVELS: MapLevelId[] = ['junior', 'middle', 'senior'];

/** The level tabs and the stored ticks rely on these: three levels in order, and stable unique check ids. */
export function checkMap(map: KnowledgeMap): string[] {
  const issues: string[] = [];
  const layerIds = new Set<string>();
  for (const layer of map.layers) {
    if (layerIds.has(layer.id)) issues.push(`duplicate map layer "${layer.id}"`);
    layerIds.add(layer.id);
  }
  const levelIds = map.levels.map((l) => l.id);
  if (levelIds.length > 0 && levelIds.join() !== MAP_LEVELS.join()) {
    issues.push(`map levels must be ${MAP_LEVELS.join(', ')} in that order`);
  }
  const seen = new Set<string>();
  for (const level of map.levels) {
    for (const check of level.checks) {
      const prefix = `map-${level.id}-`;
      if (!check.id.startsWith(prefix)) issues.push(`map check "${check.id}": id must start with "${prefix}"`);
      if (seen.has(check.id)) issues.push(`duplicate map check "${check.id}"`);
      seen.add(check.id);
    }
  }
  return issues;
}
```

Đổi dòng import đầu file thành:

```ts
import type { Item, KnowledgeMap, Lesson, MapLevelId, RoadmapArea, RoadmapItem, Topic } from '../core/schema';
```

- [ ] **Step 4: Loader.** Trong `src/content/load.ts`:

Thêm vào import từ `'../core/schema'`: `mapFile` (sau `lessonMeta`) và `type KnowledgeMap` (sau `type Item`). Đổi import integrity thành:

```ts
import { checkIntegrity, checkMap, checkRoadmap } from './integrity';
```

Thêm trường cuối vào `RawContent`:

```ts
  /** parsed content/map/map.json; absent when there is no map */
  map?: unknown;
```

Thêm trường cuối vào `Content`:

```ts
  map: KnowledgeMap;
```

Thêm ngay trước `export class ContentError`:

```ts
export const EMPTY_MAP: KnowledgeMap = { layers: [], rows: [], levels: [], arch: [], trace: [], habits: [] };

```

Trong `loadContent`, thêm ngay trước dòng `issues.push(...checkIntegrity(topics, items, lessons));`:

```ts
  const map: KnowledgeMap =
    raw.map === undefined ? EMPTY_MAP : (parse(mapFile, raw.map, '/content/map/map.json') ?? EMPTY_MAP);

```

thêm ngay sau dòng `issues.push(...checkRoadmap(areas, roadmapItems, topics, lessons));`:

```ts
  issues.push(...checkMap(map));
```

và đổi dòng `return` cuối thành:

```ts
  return { topics, items, lessons, challenges, roadmap: { areas, items: roadmapItems }, map };
```

- [ ] **Step 5: Đọc file nội dung.** Trong `src/content/index.ts`, thêm ngay sau khối `roadmapFiles`:

```ts
const mapFiles = import.meta.glob('/content/map/map.json', { eager: true, import: 'default' });
```

và thêm trường cuối vào lời gọi `loadContent({ … })`:

```ts
  map: mapFiles['/content/map/map.json'],
```

- [ ] **Step 6: Fixture `Content` trong test cũ.** `Content` giờ bắt buộc có `map`. Trong `src/app/report.test.ts` và `src/app/sessionService.test.ts`:

Đổi `import type { Content } from '../content/load';` thành:

```ts
import { EMPTY_MAP, type Content } from '../content/load';
```

và thêm dòng sau ngay dưới `roadmap: { areas: [], items: [] },` trong object `content`:

```ts
  map: EMPTY_MAP,
```

- [ ] **Step 7: Test cho hàm thuần.** Tạo `src/app/map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MapLevel, MapRow } from '../core/schema';
import { filterRows, levelProgress } from './map';

const L = (s: string) => ({ vi: s, en: s });
const row = (vi: string, en: string, rn: string, ios: string, android: string): MapRow => ({ concept: { vi, en }, rn, ios, android });
const rows = [
  row('Danh sách dài', 'Long list', 'FlatList', 'UITableView', 'RecyclerView'),
  row('Cấu hình app', 'App config', 'app.json', 'Info.plist', 'AndroidManifest.xml'),
];

describe('filterRows', () => {
  it('returns every row for an empty or blank query', () => {
    expect(filterRows(rows, '', 'en')).toEqual(rows);
    expect(filterRows(rows, '   ', 'vi')).toEqual(rows);
  });

  it('matches platform terms ignoring case', () => {
    expect(filterRows(rows, 'PLIST', 'en')).toEqual([rows[1]]);
    expect(filterRows(rows, 'recyclerview', 'vi')).toEqual([rows[0]]);
  });

  it('matches the concept name in the current language only', () => {
    expect(filterRows(rows, 'danh sách', 'vi')).toEqual([rows[0]]);
    expect(filterRows(rows, 'danh sách', 'en')).toEqual([]);
    expect(filterRows(rows, 'long', 'en')).toEqual([rows[0]]);
  });
});

describe('levelProgress', () => {
  const level: MapLevel = {
    id: 'junior', name: L('Junior'), tag: L('t'), rn: [L('a')], ios: [L('b')], android: [L('c')],
    checks: [1, 2, 3, 4].map((n) => ({ id: `map-junior-${n}`, text: L(`q${n}`) })),
  };

  it('counts the ticked checks of this level and ignores other ids', () => {
    expect(levelProgress(level, new Set(['map-junior-1', 'map-junior-3', 'map-middle-1']))).toEqual({ done: 2, total: 4 });
    expect(levelProgress(level, new Set())).toEqual({ done: 0, total: 4 });
  });
});
```

- [ ] **Step 8: Hàm thuần.** Tạo `src/app/map.ts`:

```ts
import type { MapLevel, MapRow } from '../core/schema';
import type { Lang } from '../core/types';

export const MAP_SETTING = 'map';

/** Rows whose concept, in the reader's language, or any platform term contains the query, ignoring case. */
export function filterRows(rows: MapRow[], query: string, lang: Lang): MapRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => [r.concept[lang], r.rn, r.ios, r.android].some((s) => s.toLowerCase().includes(q)));
}

export function levelProgress(level: MapLevel, checked: ReadonlySet<string>): { done: number; total: number } {
  return { done: level.checks.filter((c) => checked.has(c.id)).length, total: level.checks.length };
}
```

- [ ] **Step 9: Backup.** Trong `src/app/backup.test.ts`, thêm ngay sau test `'keeps roadmap ticks …'`:

```ts
  it('keeps knowledge map ticks and rejects a value that is not a list of ids', () => {
    const withMap: Snapshot = { ...snapshot, settings: [...snapshot.settings, { key: 'map', value: ['map-junior-1'] }] };
    expect(parseBackup(JSON.stringify(toBackup(withMap, NOW)))).toEqual(withMap);
    const bad = toBackup({ ...snapshot, settings: [{ key: 'map', value: { 'map-junior-1': true } }] }, NOW);
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('settings.0.value');
  });
```

Trong `src/app/backup.ts`, thêm import ngay trên dòng import `./roadmap`:

```ts
import { MAP_SETTING } from './map';
```

và thêm dòng cuối vào `KNOWN_SETTINGS`:

```ts
  [MAP_SETTING]: isStringArray,
```

- [ ] **Step 10: Router.** Trong `src/app/router.test.ts`:
  - thêm `expect(parseRoute('#/map')).toEqual({ name: 'map' });` ngay sau dòng `'#/roadmap'`;
  - thêm `{ name: 'map' },` ngay sau `{ name: 'roadmap' },` trong mảng `routes`.

Trong `src/app/router.ts`:
  - thêm `| { name: 'map' }` ngay sau `| { name: 'roadmap' }` trong type `Route`;
  - thêm `case 'map':` ngay sau `case 'roadmap':` trong `parseRoute`.

`href` không cần sửa: nhánh `default` đã trả `#/map`.

- [ ] **Step 11: TopBar.** Trong `src/ui/Chrome.tsx`, đổi khai báo `NAV` thành:

```ts
const NAV: { name: 'today' | 'library' | 'roadmap' | 'map' | 'progress' | 'settings'; label: UiKey }[] = [
  { name: 'today', label: 'today' },
  { name: 'library', label: 'library' },
  { name: 'roadmap', label: 'roadmap' },
  { name: 'map', label: 'map' },
  { name: 'progress', label: 'progress' },
  { name: 'settings', label: 'settings' },
];
```

- [ ] **Step 12: Chuỗi UI.** Trong `src/i18n/strings.ts`, thêm ngay sau dòng `markKnown`:

```ts
  map: { vi: 'Bản đồ', en: 'Map' },
  kmTitle: { vi: 'Bản đồ kiến thức', en: 'Knowledge map' },
  kmSub: {
    vi: 'Mỗi thuật ngữ bạn gặp đều thuộc một trong ba tầng. Tìm tầng của nó, tìm hàng của nó trong bảng đối chiếu, rồi tự kiểm tra ở cấp độ của bạn.',
    en: 'Every term you meet lives in one of three layers. Find its layer, find its row in the translation table, then check yourself at your level.',
  },
  kmLayersTitle: { vi: 'Một app RN là hai app native chứa một JS engine', en: 'An RN app is two native apps hosting a JS engine' },
  kmLayersSub: {
    vi: 'JavaScript của bạn mô tả UI. Runtime React Native biến mô tả đó thành view native thật trên từng nền tảng.',
    en: 'Your JavaScript describes the UI. The React Native runtime turns that description into real native views on each platform.',
  },
  kmRowsTitle: { vi: 'Một khái niệm, ba tên gọi', en: 'One concept, three names' },
  kmRowsSub: {
    vi: 'Học theo hàng, đừng học từng từ riêng lẻ. Gặp thuật ngữ mới thì tìm nó ở đây để biết nó thuộc hàng nào.',
    en: 'Learn these as rows, not as separate words. When a new term shows up, search for it and see which row it belongs to.',
  },
  kmSearch: { vi: 'Tìm thuật ngữ, ví dụ Gradle, Activity, plist…', en: 'Search a term, e.g. Gradle, Activity, plist…' },
  kmRowsCount: { vi: '{n}/{total} khái niệm', en: '{n} of {total} concepts' },
  kmNoMatch: { vi: 'Không có khái niệm nào khớp "{q}". Thử một từ ngắn hơn.', en: 'No concept matches "{q}". Try a shorter word.' },
  kmConcept: { vi: 'Khái niệm', en: 'Concept' },
  kmLevelsTitle: { vi: 'Cần biết gì, và tự kiểm tra thế nào', en: 'What to know, and how to check yourself' },
  kmChecksTitle: { vi: 'Bạn trả lời được không?', en: 'Can you answer these?' },
  kmArchTitle: { vi: 'Kiến trúc cũ và kiến trúc mới', en: 'Old architecture vs. new architecture' },
  kmArchSub: {
    vi: 'Kiến trúc mới là mặc định từ RN 0.76. Bài blog và câu trả lời Stack Overflow cũ vẫn dùng tên cũ, nên rất dễ nhầm.',
    en: 'The new architecture has been the default since RN 0.76. Older blog posts and Stack Overflow answers use the old names, which is a common source of confusion.',
  },
  kmOld: { vi: 'Cũ', en: 'Old' },
  kmNew: { vi: 'Mới', en: 'New' },
  kmChange: { vi: 'Điều gì thay đổi', en: 'What changed' },
  kmTraceTitle: { vi: 'Từ một cú chạm tới pixel trên màn hình', en: 'From a tap to pixels on screen' },
  kmTraceSub: {
    vi: 'Nếu bạn tự giải thích được từng bước, bạn đã hiểu phần lớn kiến thức từ Middle tới Senior.',
    en: 'If you can explain each step in your own words, you understand most of the mid-to-senior material.',
  },
  kmHabitsTitle: { vi: 'Năm thói quen', en: 'Five habits' },
```

- [ ] **Step 13: Màn hình.** Tạo `src/screens/MapScreen.tsx`:

```tsx
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
                rows.map((r, i) => (
                  <tr key={i}>
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
```

- [ ] **Step 14: CSS.** Trong `src/ui/app.css`, thêm ngay trước dòng `@media (max-width: 720px) {`:

```css
/* Knowledge map */
.km-layers { display: flex; flex-direction: column; gap: var(--space-2); }
.km-layer { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--surface-raised); }
.km-layer-js { border-left: 4px solid var(--accent-ink); }
.km-layer-runtime { border-left: 4px solid var(--mastery-learning); }
.km-layer-ios, .km-layer-android { border-left: 4px solid var(--correct); }
.km-native { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-2); }
.km-search { flex: 1 1 260px; min-height: 40px; padding: 0 var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--surface-raised); color: var(--ink); font: inherit; }
.km-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-lg); }
.km-table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 14px; line-height: 20px; }
.km-table th, .km-table td { padding: 10px var(--space-3); text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
.km-table th { background: var(--surface-raised); font-size: 12px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: var(--ink-muted); }
.km-table tbody tr:last-child td { border-bottom: 0; }
.km-table td.num { font-size: 13px; }
.km-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); }
.km-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 21px; }
.km-trace { margin: 0; padding-left: 24px; display: flex; flex-direction: column; gap: var(--space-2); }
.km-trace li > span { display: block; }
.km-habits { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); }
.km-h3 { margin: 0; font: 600 16px/22px var(--font-display); }

```

- [ ] **Step 15: App.** Trong `src/App.tsx`:

Thêm import (giữ thứ tự chữ cái của các dòng import):

```ts
import { MAP_SETTING } from './app/map';
import { MapScreen } from './screens/MapScreen';
```

Thêm `map: string[];` ngay sau `roadmap: string[];` trong `interface Booted`.

Thay khối `useEffect` boot bằng:

```tsx
  useEffect(() => {
    let live = true;
    const ready = (repo: Repo, persistent: boolean, lang: Lang, theme: ThemePref, roadmap: string[], map: string[]) => {
      if (live) setBoot({ repo, persistent, lang, theme, roadmap, map, service: createSessionService(repo, content) });
    };
    void openRepo()
      .then(async ({ repo, persistent }) => {
        const [lang, theme, roadmap, map] = await Promise.all([
          repo.getSetting<unknown>('lang'),
          repo.getSetting<unknown>('theme'),
          repo.getSetting<unknown>(ROADMAP_SETTING),
          repo.getSetting<unknown>(MAP_SETTING),
        ]);
        ready(repo, persistent, lang === 'en' ? 'en' : 'vi', isThemePref(theme) ? theme : 'dark', readChecked(roadmap), readChecked(map));
      })
      .catch(() => ready(createMemoryRepo(), false, 'vi', 'dark', [], []));
    return () => {
      live = false;
    };
  }, []);
```

Thay `const toggleRoadmap = useCallback(…, [boot]);` bằng:

```tsx
  const toggleTicks = useCallback(
    (list: 'roadmap' | 'map', id: string) => {
      if (!boot) return;
      const before = boot[list];
      const next = toggleChecked(before, id);
      setBoot({ ...boot, [list]: next });
      // roll the tick back when it could not be stored, so the screen never shows an unsaved state
      boot.repo.setSetting(TICK_SETTING[list], next).catch(() => setBoot((b) => (b ? { ...b, [list]: before } : b)));
    },
    [boot],
  );
```

Thêm ngay trên `export function App()`:

```tsx
const TICK_SETTING = { roadmap: ROADMAP_SETTING, map: MAP_SETTING } as const;

```

Đổi dòng render `RoadmapScreen` và thêm dòng `MapScreen` ngay sau nó:

```tsx
        {route.name === 'roadmap' ? <RoadmapScreen service={service} content={content} checked={boot.roadmap} onChecked={(id) => toggleTicks('roadmap', id)} /> : null}
        {route.name === 'map' ? <MapScreen content={content} checked={boot.map} onChecked={(id) => toggleTicks('map', id)} /> : null}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/content src/app` rồi `npx tsc --noEmit`. Kỳ vọng: load thêm 4 test, map 4, backup thêm 1, router vẫn pass; tsc không lỗi. Lúc này chưa có `map.json` nên màn `#/map` chỉ có tiêu đề các phần.

**Commit (controller):** `P9: add the knowledge map screen, schema and route`

---

### Task 2: Nội dung `content/map/map.json`

Một agent viết file, chuyển từ trang gốc `/Users/warren/Downloads/rn-knowledge-map.html` (phần HTML và hai hằng `ROWS`, `LEVELS` trong `<script>`). Agent:
- đọc spec §3, schema `mapFile` trong `src/core/schema.ts`, và một file roadmap (ví dụ `content/roadmap/rn-middle.json`) để theo văn phong tiếng Việt;
- chỉ dùng thư mục scratch riêng; không chạy build/test, không commit.

| Phần trong JSON | Lấy từ trang gốc |
|---|---|
| `layers` | 4 khối trong `#layers`, theo thứ tự `js`, `runtime`, `ios`, `android`. `title` là chữ đậm, `body` là dòng `.who`. `parts` của `runtime` là 6 thẻ trong `.rt-parts` |
| `rows` | 28 hàng của `ROWS`: phần tử đầu là `concept` (dịch), ba phần tử sau là `rn`, `ios`, `android` (giữ nguyên) |
| `levels` | `LEVELS.jr`, `.mid`, `.sr` thành `junior`, `middle`, `senior`. `name`: Junior / Middle / Senior ở cả hai ngôn ngữ. `tag`, `rn`, `ios`, `android` (từ `droid`) dịch. `checks` có id `map-<level>-1` tới `map-<level>-4` |
| `arch` | 6 hàng của bảng `#arch`: `old`, `new` giữ nguyên, `change` dịch |
| `trace` | 7 bước của `#trace`: `step` dịch, `where` giữ nguyên |
| `habits` | 5 thẻ của `#stick` |

Quy tắc:
- **Tiếng Anh:** giữ nguyên câu của trang gốc.
- **Tiếng Việt:** câu ngắn, thẳng, giữ thuật ngữ tiếng Anh mà người làm nghề vẫn dùng (component, hook, build, signing, re-render).
- **Inline code:** tên API, file, lệnh trong câu văn thì bọc backtick, ví dụ `` `pod install` ``, `` `Info.plist` ``. Trong ba ô thuật ngữ của `rows`, trong `old`/`new` và trong `where` thì không dùng backtick.
- **Không thêm, không bớt** hàng hay mục so với trang gốc. Chỗ nào agent thấy sai về kỹ thuật thì ghi lại để báo cáo, không tự sửa; Task 3 xử lý.

- [ ] **Checkpoint (Warren):** `npx vitest run src/content`. Kỳ vọng: content test pass, gồm cả test mới ở Task 3.

---

### Task 3: Kiểm tra, tài liệu và review

- [ ] Controller thêm test vào cuối `describe('repository content', …)` trong `src/content/content.test.ts`:

```ts
  it('has a full knowledge map', () => {
    expect(content.map.layers.map((l) => l.id)).toEqual(['js', 'runtime', 'ios', 'android']);
    expect(content.map.levels.map((l) => l.id)).toEqual(['junior', 'middle', 'senior']);
    expect(content.map.rows.length).toBeGreaterThanOrEqual(20);
    expect(content.map.trace.length).toBeGreaterThan(0);
  });
```

- [ ] Controller thêm mục sau vào cuối `docs/content-guide.md`:

````markdown
## Bản đồ kiến thức

Bản đồ (`#/map`) cho người học một mô hình để xếp thuật ngữ: nó thuộc tầng nào (JS, runtime RN, native), và cùng một khái niệm được gọi là gì trên React Native, iOS và Android.

- **File:** `content/map/map.json`, một object với `layers`, `rows`, `levels`, `arch`, `trace`, `habits`. Schema là `mapFile` trong `src/core/schema.ts`.
- **Tầng:** id là `js`, `runtime`, `ios`, `android`, mỗi id một lần. `parts` (tuỳ chọn) là các phần của tầng, ví dụ "Hermes: JS engine".
- **Bảng đối chiếu:** `concept` song ngữ; `rn`, `ios`, `android` là tên API hoặc công cụ, để nguyên tiếng Anh. Không có tương đương thì ghi `—`.
- **Cấp độ:** đúng ba cấp theo thứ tự `junior`, `middle`, `senior`. Mỗi cấp có đúng 4 câu tự kiểm tra, id `map-<level>-<n>`. Ô tick của người học lưu theo id này, nên đã phát hành thì không đổi id; bỏ một câu thì dùng id mới cho câu thay thế.
- **Kiến trúc và trace:** `old`, `new`, `where` là chuỗi đơn tiếng Anh; câu giải thích song ngữ.
- **Khác Roadmap:** Roadmap liệt kê khối kiến thức theo track. Bản đồ là mô hình tổng quan và bảng tra; đừng chép mục Roadmap sang đây.
- **Độ chính xác và văn phong:** như content khác. Ghi rõ phiên bản khi phụ thuộc phiên bản (ví dụ "mặc định từ RN 0.76"); bản vi giữ thuật ngữ tiếng Anh.
````

- [ ] Một agent review độ chính xác, chỉ đọc `content/map/map.json` và các chuỗi `km*` trong `src/i18n/strings.ts`. Agent kiểm tra:
  - API, công cụ và mốc phiên bản có thật và đúng ở thời điểm hiện tại (ví dụ: New Architecture mặc định từ RN 0.76, Bitcode đã bị Apple bỏ, hàng "Code shrinking" của RN có hợp lý không);
  - mỗi hàng của bảng đối chiếu thật sự là cùng một khái niệm trên ba nền tảng;
  - bản vi và bản en cùng nghĩa;
  - các ghi chú mà agent ở Task 2 báo lại.

  Agent báo lỗi theo phần và vị trí (ví dụ `rows[22].rn`), và controller giao cho một agent sửa. Sửa nội dung so với trang gốc thì ghi vào message báo cáo cho Warren.
- [ ] **Checkpoint (Warren):** `npm run check`, rồi `npm run dev` và mở `#/map`:
  - gõ "plist" vào ô tìm thì chỉ còn hàng cấu hình app, số đếm đổi theo; gõ một từ không có thì hiện dòng không khớp;
  - đổi tab cấp độ thì ba cột và bốn câu hỏi đổi theo;
  - tick một câu thì số trên tab tăng, tải lại trang vẫn còn;
  - đổi VI ⇄ EN thì mọi câu văn đổi, thuật ngữ trong bảng giữ nguyên;
  - ở bề ngang điện thoại, bảng cuộn ngang trong khung riêng, trang không cuộn ngang;
  - Cài đặt → tải bản sao lưu, file có setting `map`.

**Commit (controller):** `P9: add knowledge map content in Vietnamese and English`
