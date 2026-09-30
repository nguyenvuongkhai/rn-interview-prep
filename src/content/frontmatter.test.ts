import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('splits key: value lines from the body', () => {
    const r = parseFrontmatter('---\nid: l-1\ntopic: render/memo\n---\n# Title\nBody');
    expect(r.data).toEqual({ id: 'l-1', topic: 'render/memo' });
    expect(r.body).toBe('# Title\nBody');
  });

  it('keeps colons inside values', () => {
    expect(parseFrontmatter('---\ntitle: a: b\n---\n').data.title).toBe('a: b');
  });

  it('handles CRLF line endings', () => {
    expect(parseFrontmatter('---\r\nid: x\r\n---\r\nB').data.id).toBe('x');
  });

  it('throws without a frontmatter block', () => {
    expect(() => parseFrontmatter('# no frontmatter')).toThrow('Missing frontmatter');
  });

  it('throws on a line without a colon', () => {
    expect(() => parseFrontmatter('---\nnope\n---\n')).toThrow('Bad frontmatter line');
  });
});
