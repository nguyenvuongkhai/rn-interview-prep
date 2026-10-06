import { describe, expect, it } from 'vitest';
import { execute } from '../runner/execute';
import { content } from './index';
import { splitTitle } from './labs';

describe('repository content', () => {
  it('loads without integrity issues', () => {
    expect(content.topics.length).toBeGreaterThan(0);
    expect(content.items.map((i) => i.id)).toContain('render-memo-001');
    expect(content.lessons.map((l) => l.id)).toContain('render-memo-pitfalls');
  });

  it('every lab opens with a title in both languages', () => {
    for (const l of content.lessons.filter((x) => x.kind === 'lab')) {
      expect(splitTitle(l.body.vi).title, `${l.id} vi`).toBeTruthy();
      expect(splitTitle(l.body.en).title, `${l.id} en`).toBeTruthy();
    }
  });

  it('has roadmap items for every track and level', () => {
    for (const track of ['rn', 'ios', 'android'] as const) {
      for (const level of ['middle', 'senior'] as const) {
        const n = content.roadmap.items.filter((i) => i.track === track && i.level === level).length;
        expect(n, `${track} ${level}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('has both languages for every lesson body', () => {
    for (const l of content.lessons) {
      expect(l.body.vi.trim().length, l.id).toBeGreaterThan(0);
      expect(l.body.en.trim().length, l.id).toBeGreaterThan(0);
    }
  });

  it('every challenge solution passes all of its tests', async () => {
    expect(Object.keys(content.challenges).length).toBeGreaterThan(0);
    for (const [id, files] of Object.entries(content.challenges)) {
      const out = await execute({ solution: files.solution, tests: files.tests, include: 'all' });
      expect(out.error, id).toBeUndefined();
      expect(out.results.length, id).toBeGreaterThan(0);
      expect(out.results.filter((r) => !r.pass), id).toEqual([]);
    }
  });

  it('every challenge starter fails at least one test', async () => {
    for (const [id, files] of Object.entries(content.challenges)) {
      const out = await execute({ solution: files.starter, tests: files.tests, include: 'all' });
      expect(out.results.some((r) => !r.pass), id).toBe(true);
    }
  });
});
