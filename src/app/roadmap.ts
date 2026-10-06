import type { RoadmapArea, RoadmapItem, RoadmapLevel, RoadmapTrack } from '../core/schema';

export const ROADMAP_SETTING = 'roadmap';

export interface RoadmapGroup {
  area: RoadmapArea;
  items: RoadmapItem[];
}

export interface RoadmapView {
  groups: RoadmapGroup[];
  done: number;
  total: number;
}

/** One track and level, grouped by area in the areas file's order; areas without items are left out. */
export function roadmapView(
  areas: RoadmapArea[],
  items: RoadmapItem[],
  track: RoadmapTrack,
  level: RoadmapLevel,
  checked: ReadonlySet<string>,
): RoadmapView {
  const chosen = items.filter((i) => i.track === track && i.level === level);
  const groups = areas
    .map((area) => ({ area, items: chosen.filter((i) => i.area === area.id) }))
    .filter((g) => g.items.length > 0);
  return { groups, done: chosen.filter((i) => checked.has(i.id)).length, total: chosen.length };
}

export function toggleChecked(checked: string[], id: string): string[] {
  return checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
}

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

/** A stored value is only trusted when it is an array of ids. */
export function readChecked(value: unknown): string[] {
  return isStringArray(value) ? value : [];
}
