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
