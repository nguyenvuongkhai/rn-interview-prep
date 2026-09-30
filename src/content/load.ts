import { z } from 'zod';
import {
  challengeMeta,
  lessonMeta,
  questionFile,
  topicsFile,
  type Item,
  type Lesson,
  type LessonMeta,
  type Localized,
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
  /** path → raw text of every other file in a challenge folder */
  challengeTexts: Record<string, string>;
  /** path → raw markdown */
  lessonFiles: Record<string, string>;
}

export interface Content {
  topics: Topic[];
  items: Item[];
  lessons: Lesson[];
  challenges: Record<string, ChallengeFiles>;
}

export interface ChallengeFiles {
  prompt: Localized;
  starter: string;
  tests: string;
  solution: string;
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
  const challenges: Record<string, ChallengeFiles> = {};
  for (const [path, value] of byPath(raw.challengeFiles)) {
    const meta = parse(challengeMeta, value, path);
    if (!meta) continue;
    items.push(meta);
    const folder = /\/challenges\/([^/]+)\/meta\.json$/.exec(path)?.[1];
    if (folder !== meta.id) {
      issues.push(`${path}: id "${meta.id}" must match its folder "${folder ?? '?'}"`);
      continue;
    }
    const dir = path.slice(0, -'meta.json'.length);
    const file = (name: string) => {
      const text = raw.challengeTexts[dir + name];
      if (text === undefined) issues.push(`challenge "${meta.id}": missing ${name}`);
      return text ?? '';
    };
    challenges[meta.id] = {
      prompt: { vi: file('prompt.vi.md'), en: file('prompt.en.md') },
      starter: file('starter.ts'),
      tests: file('tests.ts'),
      solution: file('solution.ts'),
    };
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
  return { topics, items, lessons, challenges };
}
