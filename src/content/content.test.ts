import { describe, expect, it } from 'vitest';
import { content } from './index';

describe('repository content', () => {
  it('loads without integrity issues', () => {
    expect(content.topics.length).toBeGreaterThan(0);
    expect(content.items.map((i) => i.id)).toContain('render-memo-001');
    expect(content.lessons.map((l) => l.id)).toContain('render-memo-pitfalls');
  });

  it('has both languages for every lesson body', () => {
    for (const l of content.lessons) {
      expect(l.body.vi.trim().length, l.id).toBeGreaterThan(0);
      expect(l.body.en.trim().length, l.id).toBeGreaterThan(0);
    }
  });
});
