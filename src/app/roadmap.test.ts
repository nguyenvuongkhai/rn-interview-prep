import { describe, expect, it } from 'vitest';
import type { RoadmapArea, RoadmapItem } from '../core/schema';
import { readChecked, roadmapView, toggleChecked } from './roadmap';

const L = (s: string) => ({ vi: s, en: s });
const areas: RoadmapArea[] = [{ id: 'ui', title: L('UI') }, { id: 'state', title: L('State') }, { id: 'memory', title: L('Memory') }];
const item = (id: string, over: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id, track: 'rn', level: 'middle', area: 'state', title: L(id), know: L('k'), check: [L('a'), L('b')], topics: [], lessons: [], ...over,
});

describe('roadmapView', () => {
  it('keeps one track and level, groups by area in the areas order and counts progress', () => {
    const items = [item('s1'), item('u1', { area: 'ui' }), item('s2'), item('ios1', { track: 'ios' }), item('sen1', { level: 'senior' })];
    const view = roadmapView(areas, items, 'rn', 'middle', new Set(['s2', 'ios1']));
    expect(view.groups.map((g) => [g.area.id, g.items.map((i) => i.id)])).toEqual([['ui', ['u1']], ['state', ['s1', 's2']]]);
    expect(view).toMatchObject({ done: 1, total: 3 });
  });
});

describe('checked ids', () => {
  it('toggles an id in and out', () => {
    expect(toggleChecked(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleChecked(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('reads only an array of strings from storage', () => {
    expect(readChecked(['a', 'b'])).toEqual(['a', 'b']);
    expect(readChecked(undefined)).toEqual([]);
    expect(readChecked(['a', 1])).toEqual([]);
  });
});
