import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reads headings and joins paragraph lines', () => {
    expect(parseMarkdown('## Title\nline one\nline two\n\nnext')).toEqual([
      { kind: 'heading', level: 2, text: 'Title' },
      { kind: 'paragraph', text: 'line one line two' },
      { kind: 'paragraph', text: 'next' },
    ]);
  });

  it('reads bullet lists', () => {
    expect(parseMarkdown('- a\n* b\n\nafter')).toEqual([
      { kind: 'list', items: ['a', 'b'] },
      { kind: 'paragraph', text: 'after' },
    ]);
  });

  it('keeps code fences verbatim', () => {
    expect(parseMarkdown('```ts\nconst a = 1;\n\n  b();\n```\ntext')).toEqual([
      { kind: 'code', lang: 'ts', text: 'const a = 1;\n\n  b();' },
      { kind: 'paragraph', text: 'text' },
    ]);
  });

  it('runs an unclosed fence to the end', () => {
    expect(parseMarkdown('```\nx')).toEqual([{ kind: 'code', lang: '', text: 'x' }]);
  });
});
