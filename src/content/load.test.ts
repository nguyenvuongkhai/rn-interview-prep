import { describe, expect, it } from 'vitest';
import { ContentError, loadContent, type RawContent } from './load';

const L = (s: string) => ({ vi: s, en: s });
const topics = [
  { id: 'render', title: L('Render'), parent: null, weight: 3, group: 'render' },
  { id: 'render/memo', title: L('Memo'), parent: 'render', weight: 3, group: 'render' },
];
const openQ = (id: string, over: object = {}) => ({
  id, type: 'open', topics: ['render/memo'], kind: 'core', difficulty: 2, estSeconds: 120,
  prompt: L('p'), keyPoints: [L('a'), L('b')], modelAnswer: L('m'), lessons: ['l-memo'], ...over,
});
const lesson = (lang: string, over = '') =>
  `---\nid: l-memo\ntopic: render/memo\nkind: core\nreadMinutes: 5${over}\n---\n# ${lang}`;

function raw(over: Partial<RawContent> = {}): RawContent {
  return {
    topics,
    questionFiles: { '/content/questions/render-memo.json': [openQ('q-1')] },
    challengeFiles: {},
    challengeTexts: {},
    lessonFiles: {
      '/content/lessons/render/memo.vi.md': lesson('vi'),
      '/content/lessons/render/memo.en.md': lesson('en'),
    },
    ...over,
  };
}

function issuesOf(r: RawContent): string[] {
  try {
    loadContent(r);
  } catch (e) {
    if (e instanceof ContentError) return e.issues;
    throw e;
  }
  return [];
}

describe('loadContent', () => {
  it('loads valid content and joins lesson languages', () => {
    const c = loadContent(raw());
    expect(c.topics).toHaveLength(2);
    expect(c.items.map((i) => i.id)).toEqual(['q-1']);
    expect(c.lessons[0].body).toEqual({ vi: '# vi', en: '# en' });
  });

  it('reports schema errors with the file path', () => {
    const issues = issuesOf(raw({ questionFiles: { '/content/questions/x.json': [openQ('q-1', { estSeconds: -1 })] } }));
    expect(issues.some((i) => i.startsWith('/content/questions/x.json: 0.estSeconds'))).toBe(true);
  });

  it('reports a lesson missing one language', () => {
    const issues = issuesOf(raw({ lessonFiles: { '/content/lessons/render/memo.vi.md': lesson('vi') } }));
    expect(issues).toContain('lesson "l-memo": missing en version');
  });

  it('reports lesson frontmatter that differs between languages', () => {
    const issues = issuesOf(raw({
      lessonFiles: {
        '/content/lessons/render/memo.vi.md': lesson('vi'),
        '/content/lessons/render/memo.en.md': lesson('en').replace('readMinutes: 5', 'readMinutes: 7'),
      },
    }));
    expect(issues).toContain('lesson "l-memo": vi and en frontmatter differ');
  });

  it('reports a lesson file without a language suffix', () => {
    const issues = issuesOf(raw({
      lessonFiles: { ...raw().lessonFiles, '/content/lessons/render/other.md': lesson('x') },
    }));
    expect(issues).toContain('/content/lessons/render/other.md: lesson file name must end in .vi.md or .en.md');
  });

  it('reports duplicate ids, unknown topics, unknown lessons and unknown parents', () => {
    const issues = issuesOf(raw({
      topics: [...topics, { id: 'orphan', title: L('o'), parent: 'missing', weight: 1, group: 'x' }],
      questionFiles: {
        '/content/questions/a.json': [openQ('q-1'), openQ('q-1'), openQ('q-2', { topics: ['nope'], lessons: ['l-none'] })],
      },
    }));
    expect(issues).toContain('duplicate id "q-1"');
    expect(issues).toContain('item "q-2": unknown topic "nope"');
    expect(issues).toContain('item "q-2": unknown lesson "l-none"');
    expect(issues).toContain('topic "orphan": unknown parent "missing"');
  });

  it('reports a parent cycle', () => {
    const issues = issuesOf(raw({
      topics: [
        ...topics,
        { id: 'a', title: L('a'), parent: 'b', weight: 1, group: 'x' },
        { id: 'b', title: L('b'), parent: 'a', weight: 1, group: 'x' },
      ],
    }));
    expect(issues).toContain('topic "a": parent chain has a cycle');
  });

  const meta = (id: string) => ({
    id, type: 'challenge', topics: ['render/memo'], kind: 'core', difficulty: 1, estSeconds: 300, title: L('t'),
  });
  const texts = (dir: string) =>
    Object.fromEntries(['prompt.vi.md', 'prompt.en.md', 'starter.ts', 'tests.ts', 'solution.ts'].map((f) => [`${dir}${f}`, f]));

  it('loads a challenge with its files', () => {
    const c = loadContent(raw({
      challengeFiles: { '/content/challenges/deb/meta.json': meta('deb') },
      challengeTexts: texts('/content/challenges/deb/'),
    }));
    expect(c.challenges.deb).toEqual({
      prompt: { vi: 'prompt.vi.md', en: 'prompt.en.md' }, starter: 'starter.ts', tests: 'tests.ts', solution: 'solution.ts',
    });
    expect(c.items.map((i) => i.id)).toContain('deb');
  });

  it('reports a missing challenge file', () => {
    const t = texts('/content/challenges/deb/');
    delete t['/content/challenges/deb/tests.ts'];
    const issues = issuesOf(raw({ challengeFiles: { '/content/challenges/deb/meta.json': meta('deb') }, challengeTexts: t }));
    expect(issues).toContain('challenge "deb": missing tests.ts');
  });

  it('reports a challenge id that does not match its folder', () => {
    const issues = issuesOf(raw({
      challengeFiles: { '/content/challenges/other/meta.json': meta('deb') },
      challengeTexts: texts('/content/challenges/other/'),
    }));
    expect(issues).toContain('/content/challenges/other/meta.json: id "deb" must match its folder "other"');
  });
});
