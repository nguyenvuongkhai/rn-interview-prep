# P1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Quy tắc của chủ project (ưu tiên hơn TDD mặc định):**
> - **Không chạy build hoặc test** (`npm test`, `vitest`, `tsc`, `vite build`). Mỗi task kết thúc bằng một **Checkpoint** ghi lệnh để Warren tự chạy. Khi xong task, nói rõ là chưa được kiểm chứng và dán lệnh đó ra.
> - **Không commit.** Cả phase chỉ có **một commit**, và chỉ commit khi Warren yêu cầu. Lệnh gợi ý nằm ở cuối plan.
> - **Cắt branch trước**, rồi mới viết bất kỳ file nào (Task 0).
> - Được phép chạy `npm install`, vì đó là cài package chứ không phải build/test.

**Goal:** Dựng nền tảng không có UI cho RN Interview Prep: schema nội dung song ngữ, loader có kiểm tra toàn vẹn, nội dung mẫu, và toàn bộ logic thuần trong `src/core/` (chấm điểm, lặp lại ngắt quãng, độ thành thạo, chẩn đoán lỗ hổng, ghép bài hằng ngày).

**Architecture:** Vite + React + TS SPA. Nội dung nằm trong `content/`, được nạp bằng `import.meta.glob` và kiểm tra bằng zod. Nếu có lỗi, `loadContent` ném `ContentError` liệt kê từng file và từng trường. `src/core/` chỉ chứa hàm thuần: nhận content, attempts, reviews và `now`, trả về kết quả, không đụng storage hay UI.

**Tech Stack:** Vite 6, React 19, TypeScript 5 (strict), zod 3.24+, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-30-rn-interview-prep-design.md`

**Lộ trình các plan:**
- **P1 Foundation** (plan này)
- **Design:** Design System và mockup, làm trước khi có UI
- **P2:** Storage (Dexie), Today → Test → Result
- **P3:** Runner, editor Monaco, Challenge
- **P4:** Library, Lesson, Progress
- **P5:** Nội dung MVP
- **P6:** Deploy Cloudflare Pages
- **P7:** AI (tuỳ chọn)

**Chênh lệch nhỏ so với spec (đã cố ý):**
- `Attempt` lưu luôn `misconceptionIds: string[]` do `grade()` tính ra, thay vì `selected?`. Nhờ vậy `diagnose()` không cần tra ngược lại nội dung câu hỏi.
- Tỉ lệ 4 nhóm ưu tiên (30/40/20/10) áp dụng cho **số câu quick** (mcq + spot-bug). Câu `open` và challenge được chọn theo thứ tự ưu tiên: chủ đề yếu → chưa đụng tới → bất kỳ. Cuối cùng mới căn tổng thời gian về ±10%.

---

## File structure

```
rn-interview-prep/
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── content/
│   ├── topics.json
│   ├── questions/render-memo.json
│   └── lessons/render/memo-pitfalls.{vi,en}.md
└── src/
    ├── main.tsx, App.tsx, vite-env.d.ts   # placeholder, hiện số lượng nội dung
    ├── content/
    │   ├── frontmatter.ts (+ .test.ts)    # parse frontmatter "key: value"
    │   ├── integrity.ts                   # kiểm tra tham chiếu, trùng id, vòng lặp parent
    │   ├── load.ts (+ .test.ts)           # nội dung thô → Content đã kiểm tra, hoặc ContentError
    │   └── index.ts (+ content.test.ts)   # import.meta.glob → content thật
    └── core/
        ├── schema.ts (+ .test.ts)         # schema zod và các kiểu suy ra
        ├── types.ts                       # Attempt, ReviewState, TestResult, DAY_MS
        ├── testFixtures.ts                # hàm tạo dữ liệu cho test
        ├── topics.ts                      # leafTopics
        ├── random.ts (+ .test.ts)         # RNG có seed, shuffle
        ├── grading.ts (+ .test.ts)
        ├── scheduler.ts (+ .test.ts)
        ├── mastery.ts (+ .test.ts)
        ├── recommend.ts (+ .test.ts)
        └── sessionBuilder.ts (+ .test.ts)
```

---

### Task 0: Branch và scaffold

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/vite-env.d.ts`, `src/main.tsx`, `src/App.tsx` (App tạm thời, Task 3 sẽ thay)

- [ ] **Step 1: Cắt branch** (repo mới `git init`, chưa có commit nào)

```bash
cd ~/Downloads/rn-interview-prep && git checkout -b P1-0.1.0-P1-RIP-foundation
```

- [ ] **Step 2: Viết `.gitignore`**

```gitignore
node_modules
dist
*.local
.DS_Store
```

- [ ] **Step 3: Viết `package.json`**

```json
{
  "name": "rn-interview-prep",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "check": "tsc --noEmit && vitest run",
    "build": "npm run check && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Cài dependency**

```bash
cd ~/Downloads/rn-interview-prep && npm install react@^19 react-dom@^19 zod@^3.24 && npm install -D vite@^6 @vitejs/plugin-react@^4 vitest@^3 typescript@^5 @types/react@^19 @types/react-dom@^19
```

Ghim vite 6 / vitest 3 vì máy local đang dùng Node 18.20; vite 7 cần Node từ 20.19 trở lên.

- [ ] **Step 5: Viết `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 6: Viết `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 7: Viết `index.html`, `src/vite-env.d.ts`, `src/main.tsx`, `src/App.tsx`**

`index.html`:
```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RN Interview Prep</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (tạm thời, Task 3 sẽ thay):
```tsx
export function App() {
  return <main>RN Interview Prep</main>;
}
```

- [ ] **Checkpoint (Warren chạy):** `npx tsc --noEmit`. Kỳ vọng: không lỗi.

---

### Task 1: Schema nội dung và kiểu runtime

**Files:**
- Create: `src/core/schema.ts`, `src/core/types.ts`
- Test: `src/core/schema.test.ts`

- [ ] **Step 1: Viết test**

`src/core/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { challengeMeta, lessonMeta, question, topic } from './schema';

const L = (s: string) => ({ vi: s, en: s });
const base = { id: 'q-1', topics: ['render/memo'], kind: 'core', difficulty: 2, estSeconds: 60 };

describe('question schema', () => {
  it('accepts a valid mcq and fills defaults', () => {
    const q = question.parse({
      ...base, type: 'mcq', prompt: L('p'), multi: false, answer: [0], explanation: L('e'),
      options: [{ text: L('a') }, { text: L('b'), misconception: { id: 'm-b', text: L('wrong') } }],
    });
    expect(q.lessons).toEqual([]);
  });

  it('rejects text missing a language', () => {
    const r = question.safeParse({
      ...base, type: 'mcq', prompt: { vi: 'p' }, multi: false, answer: [0], explanation: L('e'),
      options: [{ text: L('a') }, { text: L('b') }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects an mcq answer index out of range', () => {
    const r = question.safeParse({
      ...base, type: 'mcq', prompt: L('p'), multi: false, answer: [5], explanation: L('e'),
      options: [{ text: L('a') }, { text: L('b') }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a single-answer mcq with two answers', () => {
    const r = question.safeParse({
      ...base, type: 'mcq', prompt: L('p'), multi: false, answer: [0, 1], explanation: L('e'),
      options: [{ text: L('a') }, { text: L('b') }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a misconception on a correct option', () => {
    const r = question.safeParse({
      ...base, type: 'mcq', prompt: L('p'), multi: false, answer: [0], explanation: L('e'),
      options: [{ text: L('a'), misconception: { id: 'm-a', text: L('x') } }, { text: L('b') }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a spot-bug answerLine past the end of the code', () => {
    const r = question.safeParse({
      ...base, type: 'spot-bug', prompt: L('p'), code: 'a\nb', answerLine: 3,
      causeOptions: [{ text: L('a') }, { text: L('b') }], answerCause: 0, explanation: L('e'),
    });
    expect(r.success).toBe(false);
  });

  it('accepts an open question', () => {
    const q = question.parse({
      ...base, type: 'open', prompt: L('p'), keyPoints: [L('k1'), L('k2')], modelAnswer: L('m'),
    });
    expect(q.type === 'open' && q.followUps).toEqual([]);
  });

  it('rejects a non-kebab id', () => {
    const r = question.safeParse({
      ...base, id: 'Bad Id', type: 'open', prompt: L('p'), keyPoints: [L('k1'), L('k2')], modelAnswer: L('m'),
    });
    expect(r.success).toBe(false);
  });
});

describe('other schemas', () => {
  it('parses a challenge meta with default hints', () => {
    const c = challengeMeta.parse({ ...base, type: 'challenge', title: L('t') });
    expect(c.hints).toEqual([]);
  });

  it('parses a topic with a null parent', () => {
    expect(topic.parse({ id: 'render', title: L('Render'), parent: null, weight: 3, group: 'render' }).parent).toBeNull();
  });

  it('coerces lesson readMinutes from frontmatter text', () => {
    expect(lessonMeta.parse({ id: 'l-1', topic: 'render/memo', kind: 'core', readMinutes: '6' }).readMinutes).toBe(6);
  });
});
```

- [ ] **Step 2: Viết `src/core/schema.ts`**

```ts
import { z } from 'zod';

export const localized = z.object({ vi: z.string().min(1), en: z.string().min(1) });
export const kind = z.enum(['core', 'advanced', 'pitfall', 'hard-issue']);
const oneToThree = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const difficulty = oneToThree;

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be kebab-case');
const topicId = z
  .string()
  .regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/, 'topic id must be kebab-case segments joined by /');

export const misconception = z.object({ id, text: localized });
export const option = z.object({ text: localized, misconception: misconception.optional() });

const base = {
  id,
  topics: z.array(topicId).min(1).max(3),
  kind,
  difficulty,
  estSeconds: z.number().int().positive(),
  lessons: z.array(id).default([]),
};

const mcq = z.object({
  ...base,
  type: z.literal('mcq'),
  prompt: localized,
  options: z.array(option).min(2),
  answer: z.array(z.number().int().nonnegative()).min(1),
  multi: z.boolean(),
  explanation: localized,
});

const spotBug = z.object({
  ...base,
  type: z.literal('spot-bug'),
  prompt: localized,
  code: z.string().min(1),
  answerLine: z.number().int().positive(),
  causeOptions: z.array(option).min(2),
  answerCause: z.number().int().nonnegative(),
  explanation: localized,
});

const open = z.object({
  ...base,
  type: z.literal('open'),
  prompt: localized,
  keyPoints: z.array(localized).min(2),
  modelAnswer: localized,
  followUps: z.array(localized).default([]),
});

export const challengeMeta = z.object({
  ...base,
  type: z.literal('challenge'),
  title: localized,
  hints: z.array(localized).default([]),
});

export const question = z.discriminatedUnion('type', [mcq, spotBug, open]).superRefine((q, ctx) => {
  const fail = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  if (q.type === 'mcq') {
    if (q.answer.some((i) => i >= q.options.length)) fail(['answer'], 'answer index out of range');
    if (new Set(q.answer).size !== q.answer.length) fail(['answer'], 'duplicate answer index');
    if (!q.multi && q.answer.length !== 1) fail(['answer'], 'single-answer mcq must have exactly one answer');
    q.answer.forEach((i) => {
      if (q.options[i]?.misconception) fail(['options', i, 'misconception'], 'a correct option cannot carry a misconception');
    });
  }
  if (q.type === 'spot-bug') {
    if (q.answerLine > q.code.split('\n').length) fail(['answerLine'], 'answerLine is past the end of code');
    if (q.answerCause >= q.causeOptions.length) fail(['answerCause'], 'answerCause index out of range');
    if (q.causeOptions[q.answerCause]?.misconception) {
      fail(['causeOptions', q.answerCause, 'misconception'], 'the correct cause cannot carry a misconception');
    }
  }
});

export const questionFile = z.array(question);

export const topic = z.object({
  id: topicId,
  title: localized,
  parent: topicId.nullable(),
  weight: oneToThree,
  group: z.string().min(1),
});
export const topicsFile = z.array(topic);

export const lessonMeta = z.object({
  id,
  topic: topicId,
  kind,
  readMinutes: z.coerce.number().int().positive(),
});

export type Localized = z.infer<typeof localized>;
export type Kind = z.infer<typeof kind>;
export type Difficulty = z.infer<typeof difficulty>;
export type Question = z.infer<typeof question>;
export type Mcq = Extract<Question, { type: 'mcq' }>;
export type SpotBug = Extract<Question, { type: 'spot-bug' }>;
export type Open = Extract<Question, { type: 'open' }>;
export type ChallengeMeta = z.infer<typeof challengeMeta>;
export type Item = Question | ChallengeMeta;
export type Topic = z.infer<typeof topic>;
export type LessonMeta = z.infer<typeof lessonMeta>;
export type Lesson = LessonMeta & { body: Localized };
```

- [ ] **Step 3: Viết `src/core/types.ts`**

```ts
export type Lang = 'vi' | 'en';
export type Confidence = 'guess' | 'fairly' | 'sure';

export const DAY_MS = 86_400_000;

export interface TestResult {
  name: string;
  category: string;
  pass: boolean;
  error?: string;
  hidden: boolean;
}

export interface Attempt {
  id: string;
  itemId: string;
  sessionId: string;
  /** 0..1, from grade() */
  score: number;
  /** seconds */
  timeSpent: number;
  confidence: Confidence;
  usedHints: number;
  lang: Lang;
  /** epoch ms */
  at: number;
  /** from grade(): misconceptions of the wrong options picked */
  misconceptionIds: string[];
  testResults?: TestResult[];
}

export interface ReviewState {
  itemId: string;
  /** index into BOX_DAYS */
  box: number;
  /** epoch ms */
  dueAt: number;
}
```

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/core/schema.test.ts`. Kỳ vọng: 11 test pass.

---

### Task 2: Frontmatter, kiểm tra toàn vẹn và loader

**Files:**
- Create: `src/content/frontmatter.ts`, `src/content/integrity.ts`, `src/content/load.ts`
- Test: `src/content/frontmatter.test.ts`, `src/content/load.test.ts`

- [ ] **Step 1: Viết test frontmatter**

`src/content/frontmatter.test.ts`:
```ts
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
```

- [ ] **Step 2: Viết `src/content/frontmatter.ts`**

```ts
export interface Frontmatter {
  data: Record<string, string>;
  body: string;
}

/** Flat `key: value` frontmatter only — lessons need nothing richer. */
export function parseFrontmatter(src: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(src);
  if (!match) throw new Error('Missing frontmatter block');

  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon === -1) throw new Error(`Bad frontmatter line: ${line}`);
    data[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { data, body: match[2] };
}
```

- [ ] **Step 3: Viết test loader**

`src/content/load.test.ts`:
```ts
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
});
```

- [ ] **Step 4: Viết `src/content/integrity.ts`**

```ts
import type { Item, Lesson, Topic } from '../core/schema';

/** Cross-file checks the per-file schemas cannot see. Returns human-readable issues. */
export function checkIntegrity(topics: Topic[], items: Item[], lessons: Lesson[]): string[] {
  const issues: string[] = [];
  const topicIds = new Set<string>();
  for (const t of topics) {
    if (topicIds.has(t.id)) issues.push(`duplicate topic "${t.id}"`);
    topicIds.add(t.id);
  }

  const parentOf = new Map(topics.map((t) => [t.id, t.parent]));
  for (const t of topics) {
    if (t.parent !== null && !topicIds.has(t.parent)) {
      issues.push(`topic "${t.id}": unknown parent "${t.parent}"`);
      continue;
    }
    let cursor: string | null = t.parent;
    for (let steps = 0; cursor !== null; steps++) {
      if (steps > topics.length || cursor === t.id) {
        issues.push(`topic "${t.id}": parent chain has a cycle`);
        break;
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  const seen = new Set<string>();
  for (const id of [...items.map((i) => i.id), ...lessons.map((l) => l.id)]) {
    if (seen.has(id)) issues.push(`duplicate id "${id}"`);
    seen.add(id);
  }

  const lessonIds = new Set(lessons.map((l) => l.id));
  for (const item of items) {
    for (const t of item.topics) if (!topicIds.has(t)) issues.push(`item "${item.id}": unknown topic "${t}"`);
    for (const l of item.lessons) if (!lessonIds.has(l)) issues.push(`item "${item.id}": unknown lesson "${l}"`);
  }
  for (const lesson of lessons) {
    if (!topicIds.has(lesson.topic)) issues.push(`lesson "${lesson.id}": unknown topic "${lesson.topic}"`);
  }
  return issues;
}
```

Lưu ý: nếu id bị trùng trong cùng một file, câu đó vẫn đi tiếp tới đây và bị báo bởi `duplicate id`. Test ở Step 3 dựa vào hành vi này.

- [ ] **Step 5: Viết `src/content/load.ts`**

```ts
import { z } from 'zod';
import {
  challengeMeta,
  lessonMeta,
  questionFile,
  topicsFile,
  type Item,
  type Lesson,
  type LessonMeta,
  type Topic,
} from '../core/schema';
import type { Lang } from '../core/types';
import { parseFrontmatter } from './frontmatter';
import { checkIntegrity } from './integrity';

export interface RawContent {
  topics: unknown;
  /** path → parsed JSON array */
  questionFiles: Record<string, unknown>;
  /** path → parsed meta.json */
  challengeFiles: Record<string, unknown>;
  /** path → raw markdown */
  lessonFiles: Record<string, string>;
}

export interface Content {
  topics: Topic[];
  items: Item[];
  lessons: Lesson[];
}

export class ContentError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid content:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

const byPath = <T>(record: Record<string, T>) =>
  Object.entries(record).sort(([a], [b]) => a.localeCompare(b));

export function loadContent(raw: RawContent): Content {
  const issues: string[] = [];
  const parse = <S extends z.ZodTypeAny>(schema: S, value: unknown, where: string): z.infer<S> | undefined => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      issues.push(`${where}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return undefined;
  };

  const topics = parse(topicsFile, raw.topics, 'content/topics.json') ?? [];

  const items: Item[] = [];
  for (const [path, value] of byPath(raw.questionFiles)) items.push(...(parse(questionFile, value, path) ?? []));
  for (const [path, value] of byPath(raw.challengeFiles)) {
    const meta = parse(challengeMeta, value, path);
    if (meta) items.push(meta);
  }

  type Draft = { meta: LessonMeta; body: string; path: string };
  const drafts = new Map<string, Partial<Record<Lang, Draft>>>();
  for (const [path, src] of byPath(raw.lessonFiles)) {
    const lang = /\.(vi|en)\.md$/.exec(path)?.[1] as Lang | undefined;
    if (!lang) {
      issues.push(`${path}: lesson file name must end in .vi.md or .en.md`);
      continue;
    }
    let fm: ReturnType<typeof parseFrontmatter>;
    try {
      fm = parseFrontmatter(src);
    } catch (e) {
      issues.push(`${path}: ${(e as Error).message}`);
      continue;
    }
    const meta = parse(lessonMeta, fm.data, path);
    if (!meta) continue;
    const entry = drafts.get(meta.id) ?? {};
    const existing = entry[lang];
    if (existing) issues.push(`${path}: duplicate ${lang} lesson "${meta.id}" (also in ${existing.path})`);
    entry[lang] = { meta, body: fm.body, path };
    drafts.set(meta.id, entry);
  }

  const lessons: Lesson[] = [];
  for (const [id, { vi, en }] of drafts) {
    if (!vi || !en) {
      issues.push(`lesson "${id}": missing ${vi ? 'en' : 'vi'} version`);
      continue;
    }
    const same =
      vi.meta.topic === en.meta.topic && vi.meta.kind === en.meta.kind && vi.meta.readMinutes === en.meta.readMinutes;
    if (!same) issues.push(`lesson "${id}": vi and en frontmatter differ`);
    lessons.push({ ...vi.meta, body: { vi: vi.body, en: en.body } });
  }

  issues.push(...checkIntegrity(topics, items, lessons));
  if (issues.length > 0) throw new ContentError(issues);
  return { topics, items, lessons };
}
```

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/content`. Kỳ vọng: 12 test pass (5 test frontmatter, 7 test loader).

---

### Task 3: Nội dung mẫu và nạp nội dung thật

**Files:**
- Create: `content/topics.json`, `content/questions/render-memo.json`, `content/lessons/render/memo-pitfalls.vi.md`, `content/lessons/render/memo-pitfalls.en.md`, `src/content/index.ts`
- Modify: `src/App.tsx` (thay toàn bộ)
- Test: `src/content/content.test.ts`

Đây chỉ là nội dung đủ để kiểm tra schema. Chủ đề mẫu hoàn chỉnh (12–15 câu) sẽ được soạn ở P5, sau khi Warren duyệt giọng văn.

- [ ] **Step 1: Viết `content/topics.json`**

```json
[
  { "id": "render", "title": { "vi": "Render & reconciliation", "en": "Rendering & reconciliation" }, "parent": null, "weight": 3, "group": "render" },
  { "id": "render/memo", "title": { "vi": "memo, useCallback, useMemo", "en": "memo, useCallback, useMemo" }, "parent": "render", "weight": 3, "group": "render" },
  { "id": "render/effects", "title": { "vi": "useEffect và vòng đời", "en": "useEffect and lifecycle" }, "parent": "render", "weight": 3, "group": "render" },
  { "id": "architecture", "title": { "vi": "Kiến trúc React Native", "en": "React Native architecture" }, "parent": null, "weight": 3, "group": "architecture" },
  { "id": "architecture/new-arch", "title": { "vi": "Kiến trúc mới: JSI, Fabric, TurboModules", "en": "New Architecture: JSI, Fabric, TurboModules" }, "parent": "architecture", "weight": 3, "group": "architecture" },
  { "id": "performance", "title": { "vi": "Hiệu năng", "en": "Performance" }, "parent": null, "weight": 3, "group": "performance" },
  { "id": "performance/lists", "title": { "vi": "FlatList và danh sách dài", "en": "FlatList and long lists" }, "parent": "performance", "weight": 3, "group": "performance" }
]
```

- [ ] **Step 2: Viết `content/questions/render-memo.json`**

```json
[
  {
    "id": "render-memo-001",
    "type": "mcq",
    "topics": ["render/memo"],
    "kind": "pitfall",
    "difficulty": 2,
    "estSeconds": 75,
    "lessons": ["render-memo-pitfalls"],
    "multi": true,
    "prompt": {
      "vi": "Một component con được bọc `React.memo` nhưng vẫn re-render mỗi khi component cha render. Những nguyên nhân nào có thể gây ra điều này? (chọn tất cả đáp án đúng)",
      "en": "A child component wrapped in `React.memo` still re-renders every time its parent renders. Which of these could cause it? (select all that apply)"
    },
    "options": [
      { "text": { "vi": "Cha truyền một object literal mới làm prop ở mỗi lần render", "en": "The parent passes a new object literal as a prop on every render" } },
      { "text": { "vi": "Cha truyền một arrow function inline làm prop", "en": "The parent passes an inline arrow function as a prop" } },
      {
        "text": { "vi": "`React.memo` chỉ có tác dụng với class component", "en": "`React.memo` only works on class components" },
        "misconception": { "id": "memo-class-only", "text": { "vi": "Nghĩ rằng React.memo dành cho class component. Thực tế nó dành cho function component; class dùng PureComponent.", "en": "Believing React.memo is for class components. It is for function components; classes use PureComponent." } }
      },
      { "text": { "vi": "Component con dùng `useContext` và giá trị context thay đổi", "en": "The child calls `useContext` and the context value changes" } },
      {
        "text": { "vi": "`React.memo` so sánh sâu (deep equal) các prop nên luôn thấy chúng khác nhau", "en": "`React.memo` deep-compares props, so it always sees them as different" },
        "misconception": { "id": "memo-deep-compare", "text": { "vi": "Nghĩ rằng React.memo so sánh sâu. Mặc định nó so sánh nông (shallow) từng prop bằng Object.is.", "en": "Believing React.memo compares deeply. By default it shallow-compares each prop with Object.is." } }
      }
    ],
    "answer": [0, 1, 3],
    "explanation": {
      "vi": "`React.memo` so sánh nông từng prop bằng `Object.is`. Object literal và arrow function inline là tham chiếu mới ở mỗi lần render nên luôn bị xem là khác. Ngoài ra, `memo` không chặn được re-render do context mà component tự đăng ký qua `useContext`.",
      "en": "`React.memo` shallow-compares each prop with `Object.is`. Object literals and inline arrow functions are new references on every render, so they always compare as different. `memo` also cannot block re-renders caused by a context the component subscribes to with `useContext`."
    }
  },
  {
    "id": "render-memo-002",
    "type": "mcq",
    "topics": ["render/memo"],
    "kind": "core",
    "difficulty": 1,
    "estSeconds": 45,
    "lessons": ["render-memo-pitfalls"],
    "multi": false,
    "prompt": {
      "vi": "`useCallback(fn, [a])` thực sự làm gì?",
      "en": "What does `useCallback(fn, [a])` actually do?"
    },
    "options": [
      { "text": { "vi": "Trả về cùng một tham chiếu hàm giữa các lần render, miễn là `a` không đổi", "en": "Returns the same function reference across renders as long as `a` is unchanged" } },
      {
        "text": { "vi": "Ngăn component hiện tại re-render", "en": "Prevents the current component from re-rendering" },
        "misconception": { "id": "usecallback-prevents-rerender", "text": { "vi": "Nghĩ rằng useCallback ngăn được re-render. Nó chỉ giữ ổn định tham chiếu của hàm.", "en": "Believing useCallback prevents re-renders. It only keeps the function reference stable." } }
      },
      {
        "text": { "vi": "Tự động memo component con nhận hàm đó", "en": "Automatically memoizes the child that receives the function" },
        "misconception": { "id": "usecallback-memoizes-child", "text": { "vi": "Nghĩ rằng useCallback tự memo component con. Component con vẫn phải được bọc React.memo thì tham chiếu ổn định mới có tác dụng.", "en": "Believing useCallback memoizes the child. The child must still be wrapped in React.memo for a stable reference to matter." } }
      },
      {
        "text": { "vi": "Gọi `fn` một lần rồi cache giá trị trả về", "en": "Calls `fn` once and caches its return value" },
        "misconception": { "id": "usecallback-is-usememo", "text": { "vi": "Nhầm useCallback với useMemo. useMemo cache giá trị trả về, còn useCallback cache chính hàm.", "en": "Confusing useCallback with useMemo. useMemo caches a return value; useCallback caches the function itself." } }
      }
    ],
    "answer": [0],
    "explanation": {
      "vi": "`useCallback(fn, deps)` tương đương `useMemo(() => fn, deps)`: nó chỉ giữ ổn định tham chiếu của hàm. Việc này chỉ có ích khi hàm được truyền cho một component con đã bọc `React.memo`, hoặc được dùng trong mảng deps của một hook khác.",
      "en": "`useCallback(fn, deps)` is equivalent to `useMemo(() => fn, deps)`: it only keeps the function reference stable. That helps only when the function goes to a child wrapped in `React.memo`, or into another hook's dependency array."
    }
  },
  {
    "id": "render-memo-003",
    "type": "spot-bug",
    "topics": ["render/memo", "performance/lists"],
    "kind": "pitfall",
    "difficulty": 2,
    "estSeconds": 90,
    "lessons": ["render-memo-pitfalls"],
    "prompt": {
      "vi": "Mỗi lần chọn một dòng, toàn bộ các `Row` đều re-render dù đã bọc `React.memo`. Dòng nào gây ra lỗi, và vì sao?",
      "en": "Every time a row is selected, every `Row` re-renders even though it is wrapped in `React.memo`. Which line causes it, and why?"
    },
    "code": "const Row = React.memo(({ item, onPress }) => (\n  <Pressable onPress={() => onPress(item.id)}>\n    <Text>{item.title}</Text>\n  </Pressable>\n));\n\nfunction List({ data }) {\n  const [selected, setSelected] = useState(null);\n  return (\n    <FlatList\n      data={data}\n      extraData={selected}\n      renderItem={({ item }) => <Row item={item} onPress={(id) => setSelected(id)} />}\n    />\n  );\n}",
    "answerLine": 13,
    "causeOptions": [
      { "text": { "vi": "Arrow function inline tạo tham chiếu mới ở mỗi lần render, nên `React.memo` của `Row` luôn thấy prop `onPress` thay đổi", "en": "The inline arrow function is a new reference on every render, so `Row`'s `React.memo` always sees `onPress` as changed" } },
      {
        "text": { "vi": "`extraData` khiến FlatList không bao giờ re-render", "en": "`extraData` stops FlatList from ever re-rendering" },
        "misconception": { "id": "extradata-blocks-render", "text": { "vi": "Hiểu ngược vai trò của extraData. Nó báo cho FlatList biết cần render lại khi giá trị đó đổi, chứ không chặn render.", "en": "Getting extraData backwards. It tells FlatList to re-render when that value changes; it does not block rendering." } }
      },
      {
        "text": { "vi": "`React.memo` không dùng được cho component bên trong FlatList", "en": "`React.memo` does not work for components inside FlatList" },
        "misconception": { "id": "memo-not-in-flatlist", "text": { "vi": "Nghĩ rằng memo không có tác dụng trong FlatList. Thực tế, bọc memo cho item là cách tối ưu phổ biến nhất.", "en": "Believing memo has no effect inside FlatList. Memoizing items is in fact the most common list optimisation." } }
      },
      { "text": { "vi": "`useState(null)` phải được khai báo kiểu", "en": "`useState(null)` must be given a type" } }
    ],
    "answerCause": 0,
    "explanation": {
      "vi": "Ở dòng 13, `(id) => setSelected(id)` là một hàm mới ở mỗi lần `List` render. Có thể truyền thẳng `setSelected` (tham chiếu luôn ổn định), hoặc bọc hàm bằng `useCallback`. Tốt hơn nữa là chỉ truyền cho `Row` một prop `isSelected` kiểu boolean.",
      "en": "On line 13, `(id) => setSelected(id)` is a new function on every `List` render. Pass `setSelected` directly (its reference is always stable) or wrap the function in `useCallback`. Better still, pass `Row` only an `isSelected` boolean."
    }
  },
  {
    "id": "render-memo-004",
    "type": "open",
    "topics": ["render/memo", "performance/lists"],
    "kind": "hard-issue",
    "difficulty": 3,
    "estSeconds": 300,
    "lessons": ["render-memo-pitfalls"],
    "prompt": {
      "vi": "Một màn hình có danh sách 500 item bị giật mỗi khi chọn một item. Profiler cho thấy mọi Row đều re-render. Bạn sẽ điều tra và sửa như thế nào?",
      "en": "A screen with a 500-item list stutters whenever an item is selected. The profiler shows every Row re-rendering. How would you investigate and fix it?"
    },
    "keyPoints": [
      { "vi": "Dùng React DevTools Profiler (bật \"record why each component rendered\") để xác định prop nào thay đổi", "en": "Use the React DevTools Profiler (\"record why each component rendered\") to find which prop changes" },
      { "vi": "Giữ ổn định tham chiếu của callback và object truyền xuống (useCallback, useMemo, hoặc truyền thẳng setter)", "en": "Stabilise callback and object references passed down (useCallback, useMemo, or pass the setter directly)" },
      { "vi": "Bọc Row bằng React.memo và đảm bảo keyExtractor trả về key ổn định", "en": "Wrap Row in React.memo and make sure keyExtractor returns stable keys" },
      { "vi": "Chỉ truyền dữ liệu mà Row cần (ví dụ boolean isSelected) thay vì cả state selected", "en": "Pass Row only what it needs (e.g. an isSelected boolean) instead of the whole selected state" },
      { "vi": "Dùng extraData đúng cách để FlatList biết khi nào cần render lại", "en": "Use extraData correctly so FlatList knows when to re-render" }
    ],
    "modelAnswer": {
      "vi": "Đầu tiên, mình đo bằng React DevTools Profiler, bật tuỳ chọn ghi lại lý do render, để biết Row re-render vì prop nào. Thường nguyên nhân là callback hoặc object được tạo mới trong renderItem. Mình sẽ bọc Row bằng React.memo, giữ ổn định callback (truyền thẳng setter hoặc dùng useCallback), và chỉ truyền cho Row một boolean isSelected. Như vậy khi chọn item, chỉ 2 dòng thay đổi (dòng cũ và dòng mới) là render lại. Cuối cùng, mình kiểm tra keyExtractor ổn định, đặt extraData là id đang được chọn, rồi đo lại để xác nhận.",
      "en": "First I would measure with the React DevTools Profiler, recording why each component rendered, to see which prop makes Row re-render. Usually it is a callback or object created inside renderItem. I would wrap Row in React.memo, stabilise the callback (pass the setter directly or use useCallback), and give Row only an isSelected boolean, so selecting an item re-renders just the two rows that changed. Finally I would check that keyExtractor is stable, set extraData to the selected id, and profile again to confirm."
    },
    "followUps": [
      { "vi": "Nếu đã làm hết những việc trên mà vẫn giật thì bạn kiểm tra tiếp những gì?", "en": "If it still stutters after all of that, what do you check next?" },
      { "vi": "Khi nào nên dùng FlashList thay cho FlatList?", "en": "When would you switch from FlatList to FlashList?" }
    ]
  }
]
```

- [ ] **Step 3: Viết bài học mẫu**

`content/lessons/render/memo-pitfalls.vi.md`:
```markdown
---
id: render-memo-pitfalls
topic: render/memo
kind: pitfall
readMinutes: 6
---
## TL;DR
`React.memo` chỉ bỏ qua một lần render khi **mọi prop đều bằng nhau theo `Object.is`**. Hàm hoặc object được tạo mới trong lúc render sẽ làm memo mất tác dụng.

## Cơ chế bên trong
Khi component cha render, React so sánh nông (shallow) từng prop của component đã bọc memo. Chỉ cần một prop là tham chiếu mới, component con sẽ render lại. `useCallback` và `useMemo` giữ ổn định tham chiếu, nhưng chúng tự nó không ngăn được render.

## Góc phỏng vấn
- "useCallback có ngăn re-render không?" Không. Nó chỉ có ích khi kết hợp với một component con đã bọc memo.
- "Khi nào *không nên* dùng memo?" Khi prop gần như luôn thay đổi, hoặc component quá rẻ để render. Lúc đó chi phí so sánh còn lớn hơn phần tiết kiệm được.

## Lỗi thường gặp
- Truyền arrow function inline trong `renderItem`
- Truyền cả state `selected` thay vì một boolean `isSelected`
- Quên rằng context đổi thì component vẫn re-render, dù đã bọc memo

## Liên quan
`performance/lists`
```

`content/lessons/render/memo-pitfalls.en.md`:
```markdown
---
id: render-memo-pitfalls
topic: render/memo
kind: pitfall
readMinutes: 6
---
## TL;DR
`React.memo` skips a render only when **every prop is equal by `Object.is`**. A function or object created during render defeats it.

## Under the hood
When the parent renders, React shallow-compares each prop of the memoized component. A single new reference is enough to re-render the child. `useCallback` and `useMemo` keep references stable, but they do not prevent renders by themselves.

## Interview angle
- "Does useCallback prevent re-renders?" No. It only helps together with a memoized child.
- "When should you *not* use memo?" When props nearly always change, or the component is too cheap to render. Then the comparison costs more than it saves.

## Common pitfalls
- Passing inline arrow functions in `renderItem`
- Passing the whole `selected` state instead of an `isSelected` boolean
- Forgetting that a context change still re-renders a memoized component

## Related
`performance/lists`
```

- [ ] **Step 4: Viết test `src/content/content.test.ts`**

```ts
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
```

- [ ] **Step 5: Viết `src/content/index.ts`**

```ts
import { loadContent } from './load';

const topics = import.meta.glob('/content/topics.json', { eager: true, import: 'default' });
const questionFiles = import.meta.glob('/content/questions/*.json', { eager: true, import: 'default' });
const challengeFiles = import.meta.glob('/content/challenges/*/meta.json', { eager: true, import: 'default' });
const lessonFiles = import.meta.glob<string>('/content/lessons/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** Validated at import time: a broken content file fails `npm run check` and the build. */
export const content = loadContent({
  topics: topics['/content/topics.json'],
  questionFiles,
  challengeFiles,
  lessonFiles,
});
```

- [ ] **Step 6: Thay `src/App.tsx` để thấy nhanh nội dung đã nạp**

```tsx
import { content } from './content';

export function App() {
  return (
    <main>
      <h1>RN Interview Prep</h1>
      <p>
        {content.topics.length} topics · {content.items.length} items · {content.lessons.length} lessons
      </p>
    </main>
  );
}
```

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/content/content.test.ts`. Kỳ vọng: 2 test pass. Sau đó chạy `npm run dev`, trang phải hiện `7 topics · 4 items · 1 lessons`.

---

### Task 4: Fixture cho test, topics và RNG có seed

**Files:**
- Create: `src/core/testFixtures.ts`, `src/core/topics.ts`, `src/core/random.ts`
- Test: `src/core/random.test.ts`

- [ ] **Step 1: Viết `src/core/testFixtures.ts`** (dùng chung cho mọi test của `core/`)

```ts
import type { ChallengeMeta, Item, Mcq, Open, SpotBug, Topic } from './schema';
import type { Attempt } from './types';

const L = (s: string) => ({ vi: s, en: s });

/** 2026-10-01 08:00 UTC */
export const NOW = Date.UTC(2026, 9, 1, 8);

export function mcq(id: string, over: Partial<Mcq> = {}): Mcq {
  return {
    id, type: 'mcq', topics: ['render/memo'], kind: 'core', difficulty: 1, estSeconds: 60, lessons: [],
    prompt: L(id), multi: false, answer: [0], explanation: L('why'),
    options: [
      { text: L('a') },
      { text: L('b'), misconception: { id: 'm-b', text: L('b is wrong') } },
      { text: L('c'), misconception: { id: 'm-c', text: L('c is wrong') } },
    ],
    ...over,
  };
}

export function spotBug(id: string, over: Partial<SpotBug> = {}): SpotBug {
  return {
    id, type: 'spot-bug', topics: ['render/memo'], kind: 'pitfall', difficulty: 2, estSeconds: 90, lessons: [],
    prompt: L(id), code: 'a\nb\nc', answerLine: 2, answerCause: 0, explanation: L('why'),
    causeOptions: [{ text: L('right') }, { text: L('wrong'), misconception: { id: 'm-cause', text: L('x') } }],
    ...over,
  };
}

export function open(id: string, over: Partial<Open> = {}): Open {
  return {
    id, type: 'open', topics: ['render/memo'], kind: 'core', difficulty: 2, estSeconds: 300, lessons: [],
    prompt: L(id), keyPoints: [L('k1'), L('k2'), L('k3'), L('k4')], modelAnswer: L('m'), followUps: [],
    ...over,
  };
}

export function challenge(id: string, over: Partial<ChallengeMeta> = {}): ChallengeMeta {
  return {
    id, type: 'challenge', topics: ['render/memo'], kind: 'core', difficulty: 2, estSeconds: 600, lessons: [],
    title: L(id), hints: [],
    ...over,
  };
}

export function topic(id: string, parent: string | null = null, weight: 1 | 2 | 3 = 2): Topic {
  return { id, title: L(id), parent, weight, group: parent ?? id };
}

let seq = 0;
export function attempt(itemId: string, over: Partial<Attempt> = {}): Attempt {
  seq += 1;
  return {
    id: `a${seq}`, itemId, sessionId: 's1', score: 1, timeSpent: 30, confidence: 'sure',
    usedHints: 0, lang: 'vi', at: NOW, misconceptionIds: [],
    ...over,
  };
}

export const indexById = (items: Item[]) => new Map(items.map((i) => [i.id, i]));
```

- [ ] **Step 2: Viết `src/core/topics.ts`**

```ts
import type { Topic } from './schema';

/** Topics with no children — where diagnoses and gaps are reported. */
export function leafTopics(topics: Topic[]): Topic[] {
  const parents = new Set(topics.map((t) => t.parent).filter((p): p is string => p !== null));
  return topics.filter((t) => !parents.has(t.id));
}
```

- [ ] **Step 3: Viết test RNG**

`src/core/random.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, shuffle } from './random';

describe('random', () => {
  it('hashString is stable and differs by input', () => {
    expect(hashString('2026-10-01:30')).toBe(hashString('2026-10-01:30'));
    expect(hashString('2026-10-01:30')).not.toBe(hashString('2026-10-02:30'));
  });

  it('mulberry32 repeats for the same seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('shuffle returns a permutation without mutating the input', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const out = shuffle(input, mulberry32(7));
    expect(input).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect([...out].sort((x, y) => x - y)).toEqual(input);
    expect(out).toEqual(shuffle(input, mulberry32(7)));
  });
});
```

- [ ] **Step 4: Viết `src/core/random.ts`**

```ts
/** FNV-1a 32-bit. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG so the daily session is the same all day. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/core/random.test.ts`. Kỳ vọng: 3 test pass.

---

### Task 5: Chấm điểm

**Files:**
- Create: `src/core/grading.ts`
- Test: `src/core/grading.test.ts`

- [ ] **Step 1: Viết test**

`src/core/grading.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { grade } from './grading';
import { challenge, mcq, open, spotBug } from './testFixtures';
import type { TestResult } from './types';

const t = (pass: boolean, category = 'basic'): TestResult => ({ name: 'x', category, pass, hidden: false });

describe('grade', () => {
  it('mcq: exact match scores 1', () => {
    expect(grade(mcq('q'), { type: 'mcq', selected: [0] })).toEqual({ score: 1, misconceptionIds: [] });
  });

  it('mcq multi: a partial selection scores 0', () => {
    const q = mcq('q', { multi: true, answer: [0, 2], options: [{ text: { vi: 'a', en: 'a' } }, { text: { vi: 'b', en: 'b' } }, { text: { vi: 'c', en: 'c' } }] });
    expect(grade(q, { type: 'mcq', selected: [0] }).score).toBe(0);
    expect(grade(q, { type: 'mcq', selected: [2, 0] }).score).toBe(1);
  });

  it('mcq: collects misconceptions of the wrong options picked', () => {
    expect(grade(mcq('q', { multi: true }), { type: 'mcq', selected: [1, 2] }).misconceptionIds).toEqual(['m-b', 'm-c']);
  });

  it('spot-bug: half for the line, half for the cause', () => {
    const q = spotBug('s');
    expect(grade(q, { type: 'spot-bug', line: 2, cause: 0 }).score).toBe(1);
    expect(grade(q, { type: 'spot-bug', line: 2, cause: 1 })).toEqual({ score: 0.5, misconceptionIds: ['m-cause'] });
    expect(grade(q, { type: 'spot-bug', line: 1, cause: 0 }).score).toBe(0.5);
    expect(grade(q, { type: 'spot-bug', line: null, cause: null }).score).toBe(0);
  });

  it('open: fraction of distinct valid key points hit', () => {
    const q = open('o');
    expect(grade(q, { type: 'open', hitKeyPoints: [0, 2] }).score).toBe(0.5);
    expect(grade(q, { type: 'open', hitKeyPoints: [0, 0, 9] }).score).toBe(0.25);
  });

  it('challenge: pass ratio minus 0.1 per hint, floored at 0', () => {
    const c = challenge('c');
    expect(grade(c, { type: 'challenge', tests: [t(true), t(true), t(true), t(false)], usedHints: 0 }).score).toBe(0.75);
    expect(grade(c, { type: 'challenge', tests: [t(true), t(true), t(true), t(false)], usedHints: 2 }).score).toBeCloseTo(0.55);
    expect(grade(c, { type: 'challenge', tests: [t(false)], usedHints: 3 }).score).toBe(0);
    expect(grade(c, { type: 'challenge', tests: [], usedHints: 0 }).score).toBe(0);
  });

  it('throws when the response type does not match the item', () => {
    expect(() => grade(mcq('q'), { type: 'open', hitKeyPoints: [] })).toThrow('does not match');
  });
});
```

- [ ] **Step 2: Viết `src/core/grading.ts`**

```ts
import type { Item } from './schema';
import type { TestResult } from './types';

export type Response =
  | { type: 'mcq'; selected: number[] }
  | { type: 'spot-bug'; line: number | null; cause: number | null }
  | { type: 'open'; hitKeyPoints: number[] }
  | { type: 'challenge'; tests: TestResult[]; usedHints: number };

export interface GradeResult {
  /** 0..1 */
  score: number;
  misconceptionIds: string[];
}

export const HINT_PENALTY = 0.1;

type ResponseOf<T extends Response['type']> = Extract<Response, { type: T }>;

export function grade(item: Item, response: Response): GradeResult {
  if (item.type !== response.type) {
    throw new Error(`Response type "${response.type}" does not match item "${item.id}" (${item.type})`);
  }

  switch (item.type) {
    case 'mcq': {
      const { selected } = response as ResponseOf<'mcq'>;
      const picked = new Set(selected);
      const correct = new Set(item.answer);
      const exact = picked.size === correct.size && [...picked].every((i) => correct.has(i));
      const misconceptionIds = [...picked]
        .filter((i) => !correct.has(i))
        .map((i) => item.options[i]?.misconception?.id)
        .filter((m): m is string => m !== undefined);
      return { score: exact ? 1 : 0, misconceptionIds };
    }
    case 'spot-bug': {
      const { line, cause } = response as ResponseOf<'spot-bug'>;
      const lineOk = line === item.answerLine;
      const causeOk = cause === item.answerCause;
      const wrong = !causeOk && cause !== null ? item.causeOptions[cause]?.misconception?.id : undefined;
      return { score: (lineOk ? 0.5 : 0) + (causeOk ? 0.5 : 0), misconceptionIds: wrong ? [wrong] : [] };
    }
    case 'open': {
      const { hitKeyPoints } = response as ResponseOf<'open'>;
      const hits = new Set(hitKeyPoints.filter((i) => i >= 0 && i < item.keyPoints.length));
      return { score: hits.size / item.keyPoints.length, misconceptionIds: [] };
    }
    case 'challenge': {
      const { tests, usedHints } = response as ResponseOf<'challenge'>;
      if (tests.length === 0) return { score: 0, misconceptionIds: [] };
      const ratio = tests.filter((x) => x.pass).length / tests.length;
      return { score: Math.max(0, ratio - HINT_PENALTY * usedHints), misconceptionIds: [] };
    }
  }
}
```

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/core/grading.test.ts`. Kỳ vọng: 7 test pass.

---

### Task 6: Lặp lại ngắt quãng

**Files:**
- Create: `src/core/scheduler.ts`
- Test: `src/core/scheduler.test.ts`

- [ ] **Step 1: Viết test**

`src/core/scheduler.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { dueItemIds, nextReview } from './scheduler';
import { NOW } from './testFixtures';
import { DAY_MS } from './types';

describe('nextReview', () => {
  it('a wrong answer comes back in 1 day', () => {
    expect(nextReview(undefined, 'q', 0.5, 'sure', NOW)).toEqual({ itemId: 'q', box: 0, dueAt: NOW + DAY_MS });
  });

  it('a correct guess comes back in 3 days', () => {
    expect(nextReview({ itemId: 'q', box: 3, dueAt: 0 }, 'q', 1, 'guess', NOW).dueAt).toBe(NOW + 3 * DAY_MS);
  });

  it('confident correct answers climb 3 → 7 → 21 → 60 and stay at 60', () => {
    let r = nextReview(undefined, 'q', 1, 'sure', NOW);
    const days = [r.dueAt - NOW];
    for (let i = 0; i < 4; i++) {
      r = nextReview(r, 'q', 1, 'fairly', NOW);
      days.push(r.dueAt - NOW);
    }
    expect(days.map((d) => d / DAY_MS)).toEqual([3, 7, 21, 60, 60]);
  });

  it('a wrong answer at any box drops back to 1 day', () => {
    expect(nextReview({ itemId: 'q', box: 4, dueAt: 0 }, 'q', 0, 'sure', NOW).box).toBe(0);
  });

  it('0.8 counts as correct', () => {
    expect(nextReview(undefined, 'q', 0.8, 'sure', NOW).box).toBe(1);
  });
});

describe('dueItemIds', () => {
  it('returns due items, oldest first', () => {
    const reviews = [
      { itemId: 'b', box: 0, dueAt: NOW - 10 },
      { itemId: 'a', box: 0, dueAt: NOW - 20 },
      { itemId: 'c', box: 0, dueAt: NOW + 1 },
      { itemId: 'd', box: 0, dueAt: NOW },
    ];
    expect(dueItemIds(reviews, NOW)).toEqual(['a', 'b', 'd']);
  });
});
```

- [ ] **Step 2: Viết `src/core/scheduler.ts`**

```ts
import { DAY_MS, type Confidence, type ReviewState } from './types';

/** A score at or above this counts as "correct" for scheduling and diagnosis. */
export const PASS_SCORE = 0.8;
/** Days until the next review, indexed by box. */
export const BOX_DAYS = [1, 3, 7, 21, 60] as const;

export function nextReview(
  prev: ReviewState | undefined,
  itemId: string,
  score: number,
  confidence: Confidence,
  now: number,
): ReviewState {
  let box: number;
  if (score < PASS_SCORE) box = 0;
  else if (confidence === 'guess') box = 1;
  else box = prev ? Math.min(prev.box + 1, BOX_DAYS.length - 1) : 1;
  return { itemId, box, dueAt: now + BOX_DAYS[box] * DAY_MS };
}

export function dueItemIds(reviews: ReviewState[], now: number): string[] {
  return reviews
    .filter((r) => r.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.itemId.localeCompare(b.itemId))
    .map((r) => r.itemId);
}
```

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/core/scheduler.test.ts`. Kỳ vọng: 6 test pass.

---

### Task 7: Độ thành thạo

**Files:**
- Create: `src/core/mastery.ts`
- Test: `src/core/mastery.test.ts`

- [ ] **Step 1: Viết test**

`src/core/mastery.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { attemptWeight, effectiveScore, levelOf, masteryByTopic, masteryOf } from './mastery';
import { NOW, attempt, indexById, mcq, topic } from './testFixtures';
import { DAY_MS } from './types';

const q = mcq('q', { estSeconds: 60 });

describe('effectiveScore', () => {
  it('scales by confidence', () => {
    expect(effectiveScore(attempt('q', { confidence: 'sure' }), q)).toBe(1);
    expect(effectiveScore(attempt('q', { confidence: 'fairly' }), q)).toBe(0.85);
    expect(effectiveScore(attempt('q', { confidence: 'guess' }), q)).toBe(0.5);
  });

  it('subtracts 0.1 when slower than twice the estimate, never below 0', () => {
    expect(effectiveScore(attempt('q', { timeSpent: 121 }), q)).toBeCloseTo(0.9);
    expect(effectiveScore(attempt('q', { timeSpent: 120 }), q)).toBe(1);
    expect(effectiveScore(attempt('q', { score: 0, timeSpent: 500 }), q)).toBe(0);
  });
});

describe('attemptWeight', () => {
  it('weights by difficulty and halves every 14 days', () => {
    expect(attemptWeight(attempt('q'), mcq('q', { difficulty: 2 }), NOW)).toBe(1.5);
    expect(attemptWeight(attempt('q', { at: NOW - 14 * DAY_MS }), q, NOW)).toBeCloseTo(0.5);
  });
});

describe('levelOf', () => {
  it('maps value and count to a level', () => {
    expect(levelOf(0.9, 2)).toBe('insufficient');
    expect(levelOf(null, 5)).toBe('insufficient');
    expect(levelOf(0.49, 3)).toBe('weak');
    expect(levelOf(0.5, 3)).toBe('learning');
    expect(levelOf(0.8, 3)).toBe('solid');
  });
});

describe('masteryOf', () => {
  it('is a weighted mean that favours recent attempts', () => {
    const items = indexById([q]);
    const m = masteryOf(
      [attempt('q', { score: 1 }), attempt('q', { score: 1 }), attempt('q', { score: 0, at: NOW - 28 * DAY_MS })],
      items,
      NOW,
    );
    // weights 1, 1, 0.25 → (1 + 1 + 0) / 2.25
    expect(m.value).toBeCloseTo(2 / 2.25);
    expect(m).toMatchObject({ count: 3, level: 'solid' });
  });

  it('ignores attempts for unknown items', () => {
    expect(masteryOf([attempt('missing')], indexById([q]), NOW)).toEqual({ value: null, count: 0, level: 'insufficient' });
  });
});

describe('masteryByTopic', () => {
  it('rolls children up into the parent by weight', () => {
    const topics = [topic('render', null, 3), topic('render/memo', 'render', 3), topic('render/effects', 'render', 1)];
    const items = [mcq('m1'), mcq('e1', { topics: ['render/effects'] })];
    const attempts = [
      ...[1, 2, 3].map(() => attempt('m1', { score: 1 })),
      ...[1, 2, 3].map(() => attempt('e1', { score: 0 })),
    ];
    const m = masteryByTopic(topics, attempts, indexById(items), NOW);
    expect(m.get('render/memo')?.value).toBe(1);
    expect(m.get('render/effects')?.value).toBe(0);
    // (1 × 3 + 0 × 1) / 4
    expect(m.get('render')).toEqual({ value: 0.75, count: 6, level: 'learning' });
  });
});
```

- [ ] **Step 2: Viết `src/core/mastery.ts`**

```ts
import type { Item, Topic } from './schema';
import { DAY_MS, type Attempt, type Confidence } from './types';

export const CONFIDENCE_FACTOR: Record<Confidence, number> = { guess: 0.5, fairly: 0.85, sure: 1 };
export const DIFFICULTY_WEIGHT: Record<Item['difficulty'], number> = { 1: 1, 2: 1.5, 3: 2 };
export const HALF_LIFE_DAYS = 14;
export const SLOW_PENALTY = 0.1;
export const MIN_ATTEMPTS = 3;

export type Level = 'insufficient' | 'weak' | 'learning' | 'solid';

export interface Mastery {
  /** 0..1, null when there is nothing to average */
  value: number | null;
  count: number;
  level: Level;
}

export function effectiveScore(a: Attempt, item: Item): number {
  let s = a.score * CONFIDENCE_FACTOR[a.confidence];
  if (a.timeSpent > 2 * item.estSeconds) s -= SLOW_PENALTY;
  return Math.min(1, Math.max(0, s));
}

export function attemptWeight(a: Attempt, item: Item, now: number): number {
  const ageDays = Math.max(0, (now - a.at) / DAY_MS);
  return DIFFICULTY_WEIGHT[item.difficulty] * 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

export function levelOf(value: number | null, count: number): Level {
  if (value === null || count < MIN_ATTEMPTS) return 'insufficient';
  if (value < 0.5) return 'weak';
  if (value < 0.8) return 'learning';
  return 'solid';
}

export function masteryOf(attempts: Attempt[], itemsById: Map<string, Item>, now: number): Mastery {
  let sum = 0;
  let weights = 0;
  let count = 0;
  for (const a of attempts) {
    const item = itemsById.get(a.itemId);
    if (!item) continue;
    const w = attemptWeight(a, item, now);
    sum += w * effectiveScore(a, item);
    weights += w;
    count += 1;
  }
  const value = weights > 0 ? sum / weights : null;
  return { value, count, level: levelOf(value, count) };
}

/** Attempts whose item is tagged with `topicId` (primary or secondary), optionally narrowed by item. */
export function attemptsForTopic(
  topicId: string,
  attempts: Attempt[],
  itemsById: Map<string, Item>,
  filter?: (item: Item) => boolean,
): Attempt[] {
  return attempts.filter((a) => {
    const item = itemsById.get(a.itemId);
    return item !== undefined && item.topics.includes(topicId) && (!filter || filter(item));
  });
}

/** Mastery for every topic. A parent is the weight-averaged mastery of its children plus its own direct attempts. */
export function masteryByTopic(
  topics: Topic[],
  attempts: Attempt[],
  itemsById: Map<string, Item>,
  now: number,
): Map<string, Mastery> {
  const children = new Map<string, Topic[]>();
  for (const t of topics) {
    if (t.parent !== null) children.set(t.parent, [...(children.get(t.parent) ?? []), t]);
  }

  const out = new Map<string, Mastery>();
  const visit = (t: Topic): Mastery => {
    const cached = out.get(t.id);
    if (cached) return cached;

    const own = masteryOf(attemptsForTopic(t.id, attempts, itemsById), itemsById, now);
    const kids = children.get(t.id) ?? [];
    let result = own;
    if (kids.length > 0) {
      let sum = own.value !== null ? own.value * t.weight : 0;
      let weights = own.value !== null ? t.weight : 0;
      let count = own.count;
      for (const k of kids) {
        const m = visit(k);
        count += m.count;
        if (m.value !== null) {
          sum += m.value * k.weight;
          weights += k.weight;
        }
      }
      const value = weights > 0 ? sum / weights : null;
      result = { value, count, level: levelOf(value, count) };
    }
    out.set(t.id, result);
    return result;
  };

  topics.forEach(visit);
  return out;
}
```

`loadContent` đã chặn vòng lặp parent (Task 2), nên `visit` không cần tự bảo vệ nữa.

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/core/mastery.test.ts`. Kỳ vọng: 7 test pass.

---

### Task 8: Chẩn đoán và các lỗ hổng lớn nhất

**Files:**
- Create: `src/core/recommend.ts`
- Test: `src/core/recommend.test.ts`

- [ ] **Step 1: Viết test**

`src/core/recommend.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { masteryByTopic } from './mastery';
import { diagnose, topGaps } from './recommend';
import { NOW, attempt, challenge, indexById, mcq, open, spotBug, topic } from './testFixtures';
import type { TestResult } from './types';

const topics = [topic('render', null, 3), topic('render/memo', 'render', 3), topic('render/effects', 'render', 1)];
const times = <T>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

describe('diagnose', () => {
  it('flags lacks-practice when core is solid but pitfalls are weak', () => {
    const items = [mcq('c1'), spotBug('p1')];
    const attempts = [...times(3, () => attempt('c1')), ...times(2, () => attempt('p1', { score: 0 }))];
    const d = diagnose(topics, attempts, indexById(items), NOW);
    expect(d).toContainEqual({ code: 'lacks-practice', topicId: 'render/memo', core: 1, practice: 0 });
  });

  it('flags cant-explain when mcq is solid but open answers are thin', () => {
    const items = [mcq('m1', { kind: 'advanced' }), open('o1', { kind: 'advanced' })];
    const attempts = [...times(3, () => attempt('m1')), attempt('o1', { score: 0.25 })];
    expect(diagnose(topics, attempts, indexById(items), NOW)).toContainEqual({
      code: 'cant-explain', topicId: 'render/memo', recognise: 1, explain: 0.25,
    });
  });

  it('flags shaky when at least 40% of correct answers were guesses', () => {
    const items = [mcq('m1')];
    const attempts = [attempt('m1', { confidence: 'guess' }), attempt('m1', { confidence: 'guess' }), ...times(3, () => attempt('m1'))];
    expect(diagnose(topics, attempts, indexById(items), NOW)).toContainEqual({ code: 'shaky', topicId: 'render/memo', guessRatio: 0.4 });
  });

  it('flags a challenge test category that failed in two attempts', () => {
    const fail = (category: string): TestResult => ({ name: 'x', category, pass: false, hidden: true });
    const items = [challenge('ch')];
    const attempts = [
      attempt('ch', { score: 0.5, testResults: [fail('edge-case'), fail('edge-case')] }),
      attempt('ch', { score: 0.5, testResults: [fail('edge-case'), fail('async-order')] }),
    ];
    const d = diagnose(topics, attempts, indexById(items), NOW);
    expect(d).toContainEqual({ code: 'challenge-category', category: 'edge-case', failures: 2 });
    expect(d.some((x) => x.code === 'challenge-category' && x.category === 'async-order')).toBe(false);
  });

  it('flags a misconception picked in two attempts', () => {
    const items = [mcq('m1'), mcq('m2')];
    const attempts = [
      attempt('m1', { score: 0, misconceptionIds: ['memo-deep-compare'] }),
      attempt('m2', { score: 0, misconceptionIds: ['memo-deep-compare', 'other'] }),
    ];
    const d = diagnose(topics, attempts, indexById(items), NOW);
    expect(d).toContainEqual({ code: 'misconception', misconceptionId: 'memo-deep-compare', occurrences: 2 });
    expect(d.some((x) => x.code === 'misconception' && x.misconceptionId === 'other')).toBe(false);
  });

  it('reports nothing for parent topics', () => {
    const items = [mcq('c1', { topics: ['render'] }), spotBug('p1', { topics: ['render'] })];
    const attempts = [...times(3, () => attempt('c1')), ...times(2, () => attempt('p1', { score: 0 }))];
    expect(diagnose(topics, attempts, indexById(items), NOW)).toEqual([]);
  });
});

describe('topGaps', () => {
  it('ranks by (1 − mastery) × weight and builds a plan', () => {
    const items = [
      mcq('memo-a'), mcq('memo-b'), mcq('memo-c'), mcq('memo-d'),
      challenge('memo-ch', { estSeconds: 540 }),
      mcq('eff-a', { topics: ['render/effects'] }),
    ];
    const lessons = [{ id: 'memo-lesson', topic: 'render/memo', kind: 'core' as const, readMinutes: 6 }];
    const attempts = [
      ...['memo-a', 'memo-b', 'memo-c'].map((id) => attempt(id, { score: 0 })),
      attempt('memo-a', { score: 1, at: NOW + 1 }),
      ...times(3, () => attempt('eff-a', { score: 0 })),
    ];
    const mastery = masteryByTopic(topics, attempts, indexById(items), NOW);
    const gaps = topGaps({ topics, mastery, items, lessons, attempts });

    // memo: weight 3; effects: weight 1, so memo ranks first
    expect(gaps.map((g) => g.topicId)).toEqual(['render/memo', 'render/effects']);
    expect(gaps[0].plan).toEqual([
      { kind: 'read', lessonId: 'memo-lesson', minutes: 6 },
      // unattempted first, then lowest latest score; memo-a's latest is 1 so it is left out
      { kind: 'practice', itemIds: ['memo-d', 'memo-b', 'memo-c'], minutes: 3 },
      { kind: 'challenge', itemId: 'memo-ch', minutes: 9 },
    ]);
  });

  it('skips topics that are solid or lack data', () => {
    const items = [mcq('m1')];
    const attempts = times(3, () => attempt('m1'));
    const mastery = masteryByTopic(topics, attempts, indexById(items), NOW);
    expect(topGaps({ topics, mastery, items, lessons: [], attempts })).toEqual([]);
  });
});
```

- [ ] **Step 2: Viết `src/core/recommend.ts`**

```ts
import type { Item, LessonMeta, Topic } from './schema';
import type { Attempt } from './types';
import { attemptsForTopic, masteryOf, type Mastery } from './mastery';
import { PASS_SCORE } from './scheduler';
import { leafTopics } from './topics';

export type Diagnosis =
  | { code: 'lacks-practice'; topicId: string; core: number; practice: number }
  | { code: 'cant-explain'; topicId: string; recognise: number; explain: number }
  | { code: 'shaky'; topicId: string; guessRatio: number }
  | { code: 'challenge-category'; category: string; failures: number }
  | { code: 'misconception'; misconceptionId: string; occurrences: number };

export const RULES = {
  solid: 0.8,
  weakPractice: 0.5,
  weakExplain: 0.6,
  guessRatio: 0.4,
  minCore: 3,
  minPractice: 2,
  minRecognise: 3,
  minExplain: 1,
  minCorrect: 3,
  minRepeat: 2,
} as const;

const isCore = (i: Item) => i.kind === 'core';
const isPractice = (i: Item) => i.kind === 'pitfall' || i.kind === 'hard-issue';
const isRecognise = (i: Item) => i.type === 'mcq';
const isExplain = (i: Item) => i.type === 'open';

const countBy = (keys: Iterable<string>, into: Map<string, number>) => {
  for (const k of keys) into.set(k, (into.get(k) ?? 0) + 1);
};

export function diagnose(topics: Topic[], attempts: Attempt[], itemsById: Map<string, Item>, now: number): Diagnosis[] {
  const out: Diagnosis[] = [];
  const slice = (topicId: string, filter?: (i: Item) => boolean) =>
    masteryOf(attemptsForTopic(topicId, attempts, itemsById, filter), itemsById, now);

  for (const t of leafTopics(topics)) {
    const core = slice(t.id, isCore);
    const practice = slice(t.id, isPractice);
    if (
      core.value !== null && practice.value !== null &&
      core.count >= RULES.minCore && practice.count >= RULES.minPractice &&
      core.value >= RULES.solid && practice.value < RULES.weakPractice
    ) {
      out.push({ code: 'lacks-practice', topicId: t.id, core: core.value, practice: practice.value });
    }

    const recognise = slice(t.id, isRecognise);
    const explain = slice(t.id, isExplain);
    if (
      recognise.value !== null && explain.value !== null &&
      recognise.count >= RULES.minRecognise && explain.count >= RULES.minExplain &&
      recognise.value >= RULES.solid && explain.value < RULES.weakExplain
    ) {
      out.push({ code: 'cant-explain', topicId: t.id, recognise: recognise.value, explain: explain.value });
    }

    const correct = attemptsForTopic(t.id, attempts, itemsById).filter((a) => a.score >= PASS_SCORE);
    if (correct.length >= RULES.minCorrect) {
      const guessRatio = correct.filter((a) => a.confidence === 'guess').length / correct.length;
      if (guessRatio >= RULES.guessRatio) out.push({ code: 'shaky', topicId: t.id, guessRatio });
    }
  }

  const categoryFailures = new Map<string, number>();
  const misconceptions = new Map<string, number>();
  for (const a of attempts) {
    // each counts once per attempt
    countBy(new Set((a.testResults ?? []).filter((r) => !r.pass).map((r) => r.category)), categoryFailures);
    countBy(new Set(a.misconceptionIds), misconceptions);
  }
  const repeated = (m: Map<string, number>) =>
    [...m].filter(([, n]) => n >= RULES.minRepeat).sort(([a, x], [b, y]) => y - x || a.localeCompare(b));

  for (const [category, failures] of repeated(categoryFailures)) out.push({ code: 'challenge-category', category, failures });
  for (const [misconceptionId, occurrences] of repeated(misconceptions)) out.push({ code: 'misconception', misconceptionId, occurrences });
  return out;
}

export type PlanStep =
  | { kind: 'read'; lessonId: string; minutes: number }
  | { kind: 'practice'; itemIds: string[]; minutes: number }
  | { kind: 'challenge'; itemId: string; minutes: number };

export interface Gap {
  topicId: string;
  mastery: number;
  priority: number;
  plan: PlanStep[];
}

export const PRACTICE_COUNT = 3;

export interface GapInput {
  topics: Topic[];
  mastery: Map<string, Mastery>;
  items: Item[];
  lessons: LessonMeta[];
  attempts: Attempt[];
}

export function topGaps({ topics, mastery, items, lessons, attempts }: GapInput, limit = 3): Gap[] {
  const latest = latestScoreByItem(attempts);
  return leafTopics(topics)
    .flatMap((t) => {
      const m = mastery.get(t.id);
      if (!m || m.level === 'insufficient' || m.value === null || m.value >= RULES.solid) return [];
      return [{ topicId: t.id, mastery: m.value, priority: (1 - m.value) * t.weight, plan: planFor(t.id, items, lessons, latest) }];
    })
    .sort((a, b) => b.priority - a.priority || a.topicId.localeCompare(b.topicId))
    .slice(0, limit);
}

function latestScoreByItem(attempts: Attempt[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) out.set(a.itemId, a.score);
  return out;
}

function planFor(topicId: string, items: Item[], lessons: LessonMeta[], latest: Map<string, number>): PlanStep[] {
  const steps: PlanStep[] = [];
  const lesson = lessons.filter((l) => l.topic === topicId).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (lesson) steps.push({ kind: 'read', lessonId: lesson.id, minutes: lesson.readMinutes });

  // unattempted (-1) first, then lowest latest score
  const byNeed = (a: Item, b: Item) => (latest.get(a.id) ?? -1) - (latest.get(b.id) ?? -1) || a.id.localeCompare(b.id);
  const own = items.filter((i) => i.topics[0] === topicId);

  const practice = own.filter((i) => i.type !== 'challenge').sort(byNeed).slice(0, PRACTICE_COUNT);
  if (practice.length > 0) {
    const seconds = practice.reduce((s, i) => s + i.estSeconds, 0);
    steps.push({ kind: 'practice', itemIds: practice.map((i) => i.id), minutes: Math.ceil(seconds / 60) });
  }

  const ch = own.filter((i) => i.type === 'challenge').sort(byNeed)[0];
  if (ch) steps.push({ kind: 'challenge', itemId: ch.id, minutes: Math.ceil(ch.estSeconds / 60) });
  return steps;
}
```

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/core/recommend.test.ts`. Kỳ vọng: 8 test pass.

---

### Task 9: Ghép bài hằng ngày

**Files:**
- Create: `src/core/sessionBuilder.ts`
- Test: `src/core/sessionBuilder.test.ts`

- [ ] **Step 1: Viết test**

`src/core/sessionBuilder.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { masteryByTopic } from './mastery';
import { buildSession, type BuildInput, type Duration } from './sessionBuilder';
import { NOW, attempt, challenge, indexById, mcq, open, spotBug, topic } from './testFixtures';
import type { Item } from './schema';
import { DAY_MS } from './types';

const topics = [
  topic('render', null, 3), topic('render/memo', 'render', 3), topic('render/effects', 'render', 3),
  topic('perf', null, 3), topic('perf/lists', 'perf', 3),
];
const leafIds = ['render/memo', 'render/effects', 'perf/lists'];

const bank: Item[] = [
  ...Array.from({ length: 60 }, (_, i) =>
    (i % 3 === 0 ? spotBug : mcq)(`q${i}`, { topics: [leafIds[i % 3]], difficulty: ((i % 3) + 1) as 1 | 2 | 3, estSeconds: 60 }),
  ),
  open('o1', { topics: ['render/memo'] }),
  open('o2', { topics: ['perf/lists'] }),
  challenge('ch-small', { difficulty: 1, estSeconds: 300 }),
  challenge('ch-mid', { difficulty: 2, estSeconds: 600, topics: ['perf/lists'] }),
  challenge('ch-hard', { difficulty: 3, estSeconds: 900 }),
];
const byId = indexById(bank);

function input(over: Partial<BuildInput> = {}): BuildInput {
  const attempts = over.attempts ?? [];
  return {
    duration: 30, date: '2026-10-01', now: NOW, items: bank, attempts, reviews: [],
    mastery: masteryByTopic(topics, attempts, byId, NOW),
    ...over,
  };
}
const typeOf = (id: string) => byId.get(id)!.type;

describe('buildSession', () => {
  it('is deterministic for the same date and duration', () => {
    expect(buildSession(input())).toEqual(buildSession(input()));
  });

  it('varies across dates', () => {
    const orders = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
      .map((date) => buildSession(input({ date })).itemIds.join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it.each([15, 30, 45] as Duration[])('%i minutes lands within ±10%% of the budget with no duplicates', (duration) => {
    const plan = buildSession(input({ duration }));
    expect(plan.budgetSeconds).toBe(duration * 60);
    expect(plan.estSeconds).toBeGreaterThanOrEqual(duration * 60 * 0.9);
    expect(plan.estSeconds).toBeLessThanOrEqual(duration * 60 * 1.1);
    expect(new Set(plan.itemIds).size).toBe(plan.itemIds.length);
  });

  it('matches the mix: 15 → small challenge, 30 → 1 open + 1 mid, 45 → 1 open + mid + hard', () => {
    const kinds = (d: Duration) => buildSession(input({ duration: d })).itemIds.filter((id) => typeOf(id) === 'open' || typeOf(id) === 'challenge');
    expect(kinds(15)).toEqual(['ch-small']);
    expect(kinds(30).filter((id) => typeOf(id) === 'open')).toHaveLength(1);
    expect(kinds(30).filter((id) => typeOf(id) === 'challenge')).toHaveLength(1);
    expect(kinds(45)).toContain('ch-hard');
    expect(kinds(45).filter((id) => typeOf(id) === 'challenge')).toHaveLength(2);
  });

  it('orders quick questions first, then open, then challenges', () => {
    const types = buildSession(input({ duration: 45 })).itemIds.map(typeOf);
    const rank = (t: string) => (t === 'open' ? 1 : t === 'challenge' ? 2 : 0);
    expect(types.map(rank)).toEqual([...types.map(rank)].sort((a, b) => a - b));
  });

  it('puts due reviews first', () => {
    const reviews = [{ itemId: 'q7', box: 0, dueAt: NOW - DAY_MS }, { itemId: 'q4', box: 0, dueAt: NOW - 2 * DAY_MS }];
    expect(buildSession(input({ reviews })).itemIds.slice(0, 2)).toEqual(['q4', 'q7']);
  });

  it('favours the weakest topic', () => {
    const attempts = [
      ...['q1', 'q4', 'q7'].map((id) => attempt(id, { score: 0, at: NOW - 3 * DAY_MS })), // render/effects: weak
      ...['q0', 'q3', 'q6'].map((id) => attempt(id, { score: 1, at: NOW - 3 * DAY_MS })), // render/memo: solid
      ...['q2', 'q5', 'q8'].map((id) => attempt(id, { score: 1, at: NOW - 3 * DAY_MS })), // perf/lists: solid
    ];
    const quick = buildSession(input({ attempts })).itemIds.filter((id) => ['mcq', 'spot-bug'].includes(typeOf(id)));
    const weak = quick.filter((id) => byId.get(id)!.topics[0] === 'render/effects');
    expect(weak.length).toBeGreaterThanOrEqual(4);
  });

  it('skips items attempted in the last 24 hours unless they are due', () => {
    const attempts = bank.slice(0, 50).map((i) => attempt(i.id, { at: NOW - 60_000 }));
    const reviews = [{ itemId: 'q0', box: 0, dueAt: NOW }];
    const ids = buildSession(input({ attempts, reviews })).itemIds;
    expect(ids).toContain('q0');
    const recentNotDue = ids.filter((id) => id !== 'q0' && bank.slice(0, 50).some((i) => i.id === id));
    expect(recentNotDue).toEqual([]);
  });
});
```

- [ ] **Step 2: Viết `src/core/sessionBuilder.ts`**

```ts
import type { Difficulty, Item } from './schema';
import { DAY_MS, type Attempt, type ReviewState } from './types';
import type { Mastery } from './mastery';
import { dueItemIds } from './scheduler';
import { hashString, mulberry32, shuffle } from './random';

export type Duration = 15 | 30 | 45;

interface ChallengeSlot {
  maxSeconds?: number;
  difficulties?: Difficulty[];
}

interface Mix {
  quick: number;
  open: number;
  challenges: ChallengeSlot[];
}

export const MIX: Record<Duration, Mix> = {
  15: { quick: 8, open: 0, challenges: [{ maxSeconds: 300 }] },
  30: { quick: 10, open: 1, challenges: [{ difficulties: [1, 2] }] },
  45: { quick: 12, open: 1, challenges: [{ difficulties: [1, 2] }, { difficulties: [3] }] },
};

/** Share of quick-question slots per bucket, in priority order. Unfilled slots spill to the next bucket. */
export const BUCKETS = [
  ['due', 0.3],
  ['weak', 0.4],
  ['unexplored', 0.2],
  ['stretch', 0.1],
] as const;

export const TOLERANCE = 0.1;
export const RECENT_MS = DAY_MS;

export interface BuildInput {
  duration: Duration;
  /** YYYY-MM-DD, the seed */
  date: string;
  now: number;
  items: Item[];
  attempts: Attempt[];
  reviews: ReviewState[];
  mastery: Map<string, Mastery>;
}

export interface SessionPlan {
  itemIds: string[];
  estSeconds: number;
  budgetSeconds: number;
}

const isQuick = (i: Item) => i.type === 'mcq' || i.type === 'spot-bug';

export function buildSession(input: BuildInput): SessionPlan {
  const { duration, date, now, items, attempts, reviews, mastery } = input;
  const rng = mulberry32(hashString(`${date}:${duration}`));
  const mix = MIX[duration];
  const budget = duration * 60;

  const byId = new Map(items.map((i) => [i.id, i]));
  const picked = new Set<string>();
  const recent = new Set(attempts.filter((a) => now - a.at < RECENT_MS).map((a) => a.itemId));
  const seenTopics = new Set(attempts.flatMap((a) => byId.get(a.itemId)?.topics ?? []));
  const topicValue = (i: Item) => mastery.get(i.topics[0])?.value ?? null;
  const isWeak = (i: Item) => {
    const level = mastery.get(i.topics[0])?.level;
    return level === 'weak' || level === 'learning';
  };
  // stable sort keeps the seeded shuffle order among equal values
  const weakestFirst = (pool: Item[]) =>
    shuffle(pool, rng).sort((a, b) => (topicValue(a) ?? 1) - (topicValue(b) ?? 1));

  const dueIds = new Set(dueItemIds(reviews, now));
  const due = dueItemIds(reviews, now)
    .map((id) => byId.get(id))
    .filter((i): i is Item => i !== undefined && isQuick(i));

  const quickItems = items.filter(isQuick);
  const pools: Record<(typeof BUCKETS)[number][0], Item[]> = {
    due,
    weak: weakestFirst(quickItems.filter(isWeak)),
    unexplored: shuffle(quickItems.filter((i) => !seenTopics.has(i.topics[0])), rng),
    stretch: shuffle(quickItems.filter((i) => i.difficulty === 3 && (topicValue(i) ?? 0) >= 0.5), rng),
  };
  const rest = shuffle(quickItems, rng);

  const available = (i: Item) => !picked.has(i.id) && (dueIds.has(i.id) || !recent.has(i.id));
  const take = (pool: Item[], n: number): Item[] => {
    const out: Item[] = [];
    for (const i of pool) {
      if (out.length >= n) break;
      if (available(i)) {
        picked.add(i.id);
        out.push(i);
      }
    }
    return out;
  };

  // quick questions, bucket by bucket
  const quick: Item[] = [];
  let carry = 0;
  let assigned = 0;
  BUCKETS.forEach(([name, share], index) => {
    const quota = index === BUCKETS.length - 1 ? mix.quick - assigned : Math.round(mix.quick * share);
    assigned += quota;
    const got = take(pools[name], quota + carry);
    quick.push(...got);
    carry = quota + carry - got.length;
  });
  quick.push(...take(rest, carry));

  // open and challenge: weak topic → unexplored topic → anything
  const pickOne = (candidates: Item[]): Item | undefined => {
    const preference = [
      weakestFirst(candidates.filter(isWeak)),
      shuffle(candidates.filter((i) => !seenTopics.has(i.topics[0])), rng),
      shuffle(candidates, rng),
    ];
    for (const pool of preference) {
      const [hit] = take(pool, 1);
      if (hit) return hit;
    }
    return undefined;
  };

  const opens: Item[] = [];
  for (let n = 0; n < mix.open; n++) {
    const hit = pickOne(items.filter((i) => i.type === 'open'));
    if (hit) opens.push(hit);
  }

  const challenges: Item[] = [];
  for (const slot of mix.challenges) {
    const fits = (i: Item) =>
      i.type === 'challenge' &&
      (slot.maxSeconds === undefined || i.estSeconds <= slot.maxSeconds) &&
      (slot.difficulties === undefined || slot.difficulties.includes(i.difficulty));
    const hit = pickOne(items.filter(fits)) ?? pickOne(items.filter((i) => i.type === 'challenge'));
    if (hit) challenges.push(hit);
  }

  // fit the budget: trim quick questions from the lowest-priority end, or top up from the rest
  const total = () => [...quick, ...opens, ...challenges].reduce((s, i) => s + i.estSeconds, 0);
  while (total() > budget * (1 + TOLERANCE) && quick.length > 1) {
    picked.delete(quick.pop()!.id);
  }
  while (total() < budget * (1 - TOLERANCE)) {
    const [extra] = take(rest, 1);
    if (!extra) break;
    quick.push(extra);
  }

  return {
    itemIds: [...quick, ...opens, ...challenges].map((i) => i.id),
    estSeconds: total(),
    budgetSeconds: budget,
  };
}
```

- [ ] **Checkpoint (Warren chạy):** `npx vitest run src/core/sessionBuilder.test.ts`. Kỳ vọng: 10 test pass (`it.each` sinh ra 3 test).

---

### Task 10: Kiểm chứng toàn phase và gợi ý commit

- [ ] **Step 1: Báo cho Warren** rằng phase này chưa được kiểm chứng, và đưa lệnh kiểm tra toàn bộ:

```bash
cd ~/Downloads/rn-interview-prep && npm run check
```

Kỳ vọng: `tsc` không lỗi, và Vitest báo 66 test pass trên 10 file:

| File test | Số test |
|---|---|
| schema | 11 |
| frontmatter | 5 |
| load | 7 |
| content | 2 |
| random | 3 |
| grading | 7 |
| scheduler | 6 |
| mastery | 7 |
| recommend | 8 |
| sessionBuilder | 10 |

- [ ] **Step 2: Gợi ý một commit cho cả phase** (không tự chạy, chỉ chạy khi Warren yêu cầu):

```bash
cd ~/Downloads/rn-interview-prep && git add -A -- . ':!.claude' && git commit -m "P1: foundation — bilingual content schema, loader, sample content, core engine"
```
