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
