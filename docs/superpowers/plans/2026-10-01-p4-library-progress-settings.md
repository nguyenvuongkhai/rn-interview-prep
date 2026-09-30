# P4 Library, Progress & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Quy tắc của chủ project:**
> - **Không chạy build/test/dev server.** Mỗi task kết thúc bằng Checkpoint để Warren chạy.
> - Controller commit và push sau mỗi nhóm task, message 1 dòng `P4: …`.
> - Không cài package mới.

**Goal:** Hoàn thiện phần ôn tập ngoài bài hằng ngày:
- **Thư viện:** cây chủ đề, bài học, nút luyện theo chủ đề.
- **Bài học:** đọc bài bằng Markdown, luyện ngay chủ đề đó.
- **Tiến độ:** mức sẵn sàng theo nhóm, điểm 7 tuần, streak, bản đồ chủ đề.
- **Cài đặt:** theme sáng/tối/theo hệ thống, ngôn ngữ, sao lưu và khôi phục bằng file JSON.

**Architecture:**
- **Storage:** thêm `listSessions`, `exportAll`, `importAll` vào `Repo`, có cả bản memory lẫn Dexie. Import thay toàn bộ dữ liệu trong một transaction.
- **`src/app/`:** thêm các hàm thuần `progress.ts` (streak, điểm theo tuần, nhóm chủ đề), `backup.ts` (kiểm tra file sao lưu bằng zod) và `dates.ts`. `sessionService` có thêm `stats`, `startTopicPractice`, `exportBackup`, `importBackup`.
- **Theme:** `ThemeProvider` quyết định theme dựa trên cài đặt và `prefers-color-scheme`, rồi gắn `data-theme` lên `<html>`. CSS có thêm khối `:root[data-theme="light"]` lấy từ theme light của Design System.
- **Router:** thêm các route `library`, `lesson/:id`, `progress`, `settings`. Mục đang mở trên TopBar được đánh dấu `aria-current` đúng theo route (sửa một lỗi nhỏ từ review P2).

**Tham chiếu:**
- Mockup màn 5 (Tiến độ): https://claude.ai/artifact/1fEWFdoWtZgy11ykUj2uXd
- Design System (token light): https://claude.ai/artifact/PAAJZYEC6qVDbM1FkgPbD1
- Spec §2, §10 (Màn Progress), §12, §13

---

## File structure

```
src/storage/repo.ts, dexieRepo.ts                 # thay
src/storage/repo.test.ts                          # sửa: +2 test
src/app/dates.ts                                  # mới
src/app/backup.ts (+ test)                        # mới
src/app/progress.ts (+ test)                      # mới
src/app/sessionService.ts                         # thay
src/app/sessionService.test.ts                    # sửa: +3 test
src/app/router.ts, router.test.ts                 # thay
src/ui/theme.ts (+ test), ThemeProvider.tsx, download.ts   # mới
src/ui/app.css, components.tsx, CodeEditor.tsx, Chrome.tsx # sửa / thay
src/i18n/strings.ts                               # sửa
src/screens/LibraryScreen.tsx, LessonScreen.tsx, ProgressScreen.tsx, SettingsScreen.tsx   # mới
src/screens/ResultScreen.tsx, questions/ChallengeView.tsx  # sửa
src/App.tsx                                       # thay
```

---

### Task 1: Storage — liệt kê, export, import

**Files:** Replace `src/storage/repo.ts`, `src/storage/dexieRepo.ts`. Modify `src/storage/repo.test.ts`

- [ ] **Step 1: Thêm test** vào cuối `describe.each(…)` trong `src/storage/repo.test.ts`:

```ts
  it('lists sessions by start time', async () => {
    const repo = make();
    await repo.putSession({ ...session('late', '2026-10-01'), startedAt: NOW + 5 });
    await repo.putSession(session('early', '2026-09-30'));
    expect((await repo.listSessions()).map((s) => s.id)).toEqual(['early', 'late']);
  });

  it('exports everything and imports a snapshot in place of the current data', async () => {
    const repo = make();
    await repo.putSession(session('old', '2026-09-01'));
    await repo.addAttempt(attempt('q1', { id: 'old-a' }));
    await repo.putDraft('deb', 'old');
    const snapshot = {
      sessions: [session('s', '2026-10-01')],
      attempts: [attempt('q2', { id: 'a2', sessionId: 's' })],
      reviews: [{ itemId: 'q2', box: 1, dueAt: 5 }],
      drafts: [{ challengeId: 'deb', code: 'new', updatedAt: 7 }],
      settings: [{ key: 'lang', value: 'en' }],
    };
    await repo.importAll(snapshot);
    expect(await repo.exportAll()).toEqual(snapshot);
    expect(await repo.getDraft('deb')).toBe('new');
  });
```

- [ ] **Step 2: Thay `src/storage/repo.ts`**

```ts
import type { Duration } from '../core/sessionBuilder';
import type { Attempt, ReviewState } from '../core/types';

export type SessionMode = 'daily' | 'practice';

export interface SessionRecord {
  id: string;
  /** local calendar day, YYYY-MM-DD */
  date: string;
  mode: SessionMode;
  durationMin: Duration;
  itemIds: string[];
  /** epoch ms */
  startedAt: number;
  finishedAt?: number;
  overtimeSec: number;
}

export interface DraftRecord {
  challengeId: string;
  code: string;
  updatedAt: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

/** Everything the app stores, as exported to and imported from a backup file. */
export interface Snapshot {
  sessions: SessionRecord[];
  attempts: Attempt[];
  reviews: ReviewState[];
  drafts: DraftRecord[];
  settings: SettingRecord[];
}

/** The only door to persisted data. Two implementations: Dexie (real) and memory (tests, blocked storage). */
export interface Repo {
  getSession(id: string): Promise<SessionRecord | undefined>;
  putSession(session: SessionRecord): Promise<void>;
  findSessions(date: string): Promise<SessionRecord[]>;
  /** oldest first */
  listSessions(): Promise<SessionRecord[]>;
  /** oldest first */
  listAttempts(): Promise<Attempt[]>;
  addAttempt(attempt: Attempt): Promise<void>;
  listReviews(): Promise<ReviewState[]>;
  getReview(itemId: string): Promise<ReviewState | undefined>;
  putReview(review: ReviewState): Promise<void>;
  getDraft(challengeId: string): Promise<string | undefined>;
  putDraft(challengeId: string, code: string): Promise<void>;
  getSetting<T>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: unknown): Promise<void>;
  exportAll(): Promise<Snapshot>;
  /** replaces all stored data with the snapshot */
  importAll(snapshot: Snapshot): Promise<void>;
}

export const byStart = (a: SessionRecord, b: SessionRecord) => a.startedAt - b.startedAt;
const byTime = (a: Attempt, b: Attempt) => a.at - b.at;

export function createMemoryRepo(): Repo {
  let sessions = new Map<string, SessionRecord>();
  let attempts: Attempt[] = [];
  let reviews = new Map<string, ReviewState>();
  let drafts = new Map<string, DraftRecord>();
  let settings = new Map<string, unknown>();
  return {
    async getSession(id) {
      return sessions.get(id);
    },
    async putSession(session) {
      sessions.set(session.id, session);
    },
    async findSessions(date) {
      return [...sessions.values()].filter((s) => s.date === date);
    },
    async listSessions() {
      return [...sessions.values()].sort(byStart);
    },
    async listAttempts() {
      return [...attempts].sort(byTime);
    },
    async addAttempt(attempt) {
      attempts.push(attempt);
    },
    async listReviews() {
      return [...reviews.values()];
    },
    async getReview(itemId) {
      return reviews.get(itemId);
    },
    async putReview(review) {
      reviews.set(review.itemId, review);
    },
    async getDraft(challengeId) {
      return drafts.get(challengeId)?.code;
    },
    async putDraft(challengeId, code) {
      drafts.set(challengeId, { challengeId, code, updatedAt: Date.now() });
    },
    async getSetting<T>(key: string) {
      return settings.get(key) as T | undefined;
    },
    async setSetting(key, value) {
      settings.set(key, value);
    },
    async exportAll() {
      return {
        sessions: [...sessions.values()].sort(byStart),
        attempts: [...attempts].sort(byTime),
        reviews: [...reviews.values()],
        drafts: [...drafts.values()],
        settings: [...settings].map(([key, value]) => ({ key, value })),
      };
    },
    async importAll(snapshot) {
      sessions = new Map(snapshot.sessions.map((s) => [s.id, s]));
      attempts = [...snapshot.attempts];
      reviews = new Map(snapshot.reviews.map((r) => [r.itemId, r]));
      drafts = new Map(snapshot.drafts.map((d) => [d.challengeId, d]));
      settings = new Map(snapshot.settings.map((s) => [s.key, s.value]));
    },
  };
}
```

- [ ] **Step 3: Thay `src/storage/dexieRepo.ts`**

```ts
import Dexie, { type Table } from 'dexie';
import type { Attempt, ReviewState } from '../core/types';
import { byStart, type DraftRecord, type Repo, type SessionRecord, type SettingRecord } from './repo';

// Intersection type rather than a Dexie subclass: with useDefineForClassFields a declared class field
// would overwrite the table Dexie attaches in its constructor.
export type AppDb = Dexie & {
  sessions: Table<SessionRecord, string>;
  attempts: Table<Attempt, string>;
  reviews: Table<ReviewState, string>;
  settings: Table<SettingRecord, string>;
  drafts: Table<DraftRecord, string>;
};

export function createDb(name = 'rn-interview-prep'): AppDb {
  const db = new Dexie(name) as AppDb;
  db.version(1).stores({
    sessions: 'id, date',
    attempts: 'id, sessionId, itemId, at',
    reviews: 'itemId',
    settings: 'key',
  });
  db.version(2).stores({ drafts: 'challengeId' });
  return db;
}

export function createDexieRepo(db: AppDb): Repo {
  return {
    getSession: (id) => db.sessions.get(id),
    putSession: async (session) => {
      await db.sessions.put(session);
    },
    findSessions: (date) => db.sessions.where('date').equals(date).toArray(),
    listSessions: async () => (await db.sessions.toArray()).sort(byStart),
    listAttempts: () => db.attempts.orderBy('at').toArray(),
    addAttempt: async (attempt) => {
      await db.attempts.add(attempt);
    },
    listReviews: () => db.reviews.toArray(),
    getReview: (itemId) => db.reviews.get(itemId),
    putReview: async (review) => {
      await db.reviews.put(review);
    },
    getDraft: async (challengeId) => (await db.drafts.get(challengeId))?.code,
    putDraft: async (challengeId, code) => {
      await db.drafts.put({ challengeId, code, updatedAt: Date.now() });
    },
    getSetting: async <T>(key: string) => (await db.settings.get(key))?.value as T | undefined,
    setSetting: async (key, value) => {
      await db.settings.put({ key, value });
    },
    exportAll: async () => {
      const [sessions, attempts, reviews, drafts, settings] = await Promise.all([
        db.sessions.toArray(),
        db.attempts.orderBy('at').toArray(),
        db.reviews.toArray(),
        db.drafts.toArray(),
        db.settings.toArray(),
      ]);
      return { sessions: sessions.sort(byStart), attempts, reviews, drafts, settings };
    },
    importAll: async (snapshot) => {
      await db.transaction('rw', [db.sessions, db.attempts, db.reviews, db.drafts, db.settings], async () => {
        await Promise.all([db.sessions.clear(), db.attempts.clear(), db.reviews.clear(), db.drafts.clear(), db.settings.clear()]);
        await Promise.all([
          db.sessions.bulkPut(snapshot.sessions),
          db.attempts.bulkPut(snapshot.attempts),
          db.reviews.bulkPut(snapshot.reviews),
          db.drafts.bulkPut(snapshot.drafts),
          db.settings.bulkPut(snapshot.settings),
        ]);
      });
    },
  };
}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/storage`. Kỳ vọng: 14 test pass (7 × memory, 7 × dexie).

---

### Task 2: Lớp app — ngày, sao lưu, tiến độ, service, router

**Files:** Create `src/app/dates.ts`, `src/app/backup.ts`, `src/app/backup.test.ts`, `src/app/progress.ts`, `src/app/progress.test.ts`. Replace `src/app/sessionService.ts`, `src/app/router.ts`, `src/app/router.test.ts`. Modify `src/app/sessionService.test.ts`

- [ ] **Step 1: Viết `src/app/dates.ts`**

```ts
/** Local calendar day as YYYY-MM-DD. */
export function localDate(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d - 1).getTime());
}
```

- [ ] **Step 2: Viết test** `src/app/backup.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { NOW, attempt } from '../core/testFixtures';
import type { Snapshot } from '../storage/repo';
import { backupFileName, parseBackup, toBackup } from './backup';

const snapshot: Snapshot = {
  sessions: [{ id: 's', date: '2026-10-01', mode: 'daily', durationMin: 30, itemIds: ['q1'], startedAt: NOW, overtimeSec: 0 }],
  attempts: [attempt('q1', { id: 'a1', sessionId: 's' })],
  reviews: [{ itemId: 'q1', box: 1, dueAt: NOW }],
  drafts: [{ challengeId: 'deb', code: 'x', updatedAt: NOW }],
  settings: [{ key: 'lang', value: 'en' }],
};

describe('backup', () => {
  it('round-trips through JSON', () => {
    expect(parseBackup(JSON.stringify(toBackup(snapshot, NOW)))).toEqual(snapshot);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('{oops')).toThrow('not valid JSON');
  });

  it('rejects JSON from something else', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow('Not a backup from this app: app');
  });

  it('names the broken field', () => {
    const bad = toBackup({ ...snapshot, attempts: [{ ...snapshot.attempts[0], score: 2 }] }, NOW);
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('attempts.0.score');
  });

  it('names the file after the local date', () => {
    expect(backupFileName(new Date(2026, 9, 1, 9).getTime())).toBe('rn-interview-prep-2026-10-01.json');
  });
});
```

- [ ] **Step 3: Viết `src/app/backup.ts`**

```ts
import { z } from 'zod';
import type { Snapshot } from '../storage/repo';
import { localDate } from './dates';

export const BACKUP_APP = 'rn-interview-prep';
export const BACKUP_VERSION = 1;

const testResult = z.object({
  name: z.string(), category: z.string(), pass: z.boolean(), error: z.string().optional(), hidden: z.boolean(),
});
const attempt = z.object({
  id: z.string(), itemId: z.string(), sessionId: z.string(),
  score: z.number().min(0).max(1), timeSpent: z.number().min(0),
  confidence: z.enum(['guess', 'fairly', 'sure']), usedHints: z.number().int().min(0), lang: z.enum(['vi', 'en']),
  at: z.number(), misconceptionIds: z.array(z.string()), testResults: z.array(testResult).optional(),
});
const session = z.object({
  id: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mode: z.enum(['daily', 'practice']),
  durationMin: z.union([z.literal(15), z.literal(30), z.literal(45)]), itemIds: z.array(z.string()),
  startedAt: z.number(), finishedAt: z.number().optional(), overtimeSec: z.number().min(0),
});
const review = z.object({ itemId: z.string(), box: z.number().int().min(0), dueAt: z.number() });
const draft = z.object({ challengeId: z.string(), code: z.string(), updatedAt: z.number() });
const setting = z.object({ key: z.string(), value: z.unknown() });

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number(),
  sessions: z.array(session),
  attempts: z.array(attempt),
  reviews: z.array(review),
  drafts: z.array(draft),
  settings: z.array(setting),
});

export type Backup = z.infer<typeof backupSchema>;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export function toBackup(snapshot: Snapshot, now: number): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now, ...snapshot };
}

/** Validates a backup file's text; throws BackupError naming the first bad field. */
export function parseBackup(text: string): Snapshot {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('The file is not valid JSON.');
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BackupError(`Not a backup from this app: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  const b = result.data;
  return {
    sessions: b.sessions,
    attempts: b.attempts,
    reviews: b.reviews,
    drafts: b.drafts,
    settings: b.settings.map((s) => ({ key: s.key, value: s.value })),
  };
}

export function backupFileName(now: number): string {
  return `${BACKUP_APP}-${localDate(now)}.json`;
}
```

- [ ] **Step 4: Viết test** `src/app/progress.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { masteryByTopic } from '../core/mastery';
import { NOW, attempt, indexById, mcq, topic } from '../core/testFixtures';
import { DAY_MS } from '../core/types';
import type { SessionRecord } from '../storage/repo';
import { previousDay } from './dates';
import { streak, topicGroups, weeklyScores } from './progress';

const daily = (date: string, finished = true): SessionRecord => ({
  id: date, date, mode: 'daily', durationMin: 30, itemIds: [], startedAt: 0, overtimeSec: 0, ...(finished ? { finishedAt: 1 } : {}),
});

describe('progress', () => {
  it('weeklyScores buckets attempts into 7-day windows ending now', () => {
    const weeks = weeklyScores([
      attempt('q', { score: 1, at: NOW }),
      attempt('q', { score: 0, at: NOW - 8 * DAY_MS }),
      attempt('q', { score: 1, at: NOW - 60 * DAY_MS }),
    ], NOW);
    expect(weeks).toHaveLength(7);
    expect(weeks[6]).toMatchObject({ count: 1, mean: 1 });
    expect(weeks[5]).toMatchObject({ count: 1, mean: 0 });
    expect(weeks[0]).toMatchObject({ count: 0, mean: null });
  });

  it('streak counts finished Dailies ending today, or yesterday if today is not done yet', () => {
    const sessions = [daily('2026-09-29'), daily('2026-09-30')];
    expect(streak(sessions, '2026-10-01')).toBe(2);
    expect(streak([...sessions, daily('2026-10-01')], '2026-10-01')).toBe(3);
    expect(streak([...sessions, daily('2026-10-01', false)], '2026-10-01')).toBe(2);
  });

  it('streak breaks on a missed day and ignores practice sessions', () => {
    const practice = { ...daily('2026-09-30'), mode: 'practice' as const };
    expect(streak([daily('2026-09-28'), practice], '2026-10-01')).toBe(0);
  });

  it('previousDay crosses month and year boundaries', () => {
    expect(previousDay('2026-10-01')).toBe('2026-09-30');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });

  it('topicGroups puts each leaf under its root, and a childless root under itself', () => {
    const topics = [topic('render'), topic('render/memo', 'render'), topic('render/effects', 'render'), topic('perf')];
    const items = [mcq('m1')];
    const mastery = masteryByTopic(topics, [attempt('m1')], indexById(items), NOW);
    const groups = topicGroups(topics, mastery);
    expect(groups.map((g) => [g.root.id, g.leaves.map((l) => l.topic.id)])).toEqual([
      ['render', ['render/memo', 'render/effects']],
      ['perf', ['perf']],
    ]);
    expect(groups[0].leaves[0].mastery?.count).toBe(1);
  });
});
```

- [ ] **Step 5: Viết `src/app/progress.ts`**

```ts
import type { Mastery } from '../core/mastery';
import type { Topic } from '../core/schema';
import { leafTopics } from '../core/topics';
import { DAY_MS, type Attempt } from '../core/types';
import type { SessionRecord } from '../storage/repo';
import { previousDay } from './dates';

export interface WeekScore {
  /** window start, exclusive; epoch ms */
  start: number;
  mean: number | null;
  count: number;
}

/** Mean score per 7-day window, oldest first; the last window ends at `now`. */
export function weeklyScores(attempts: Attempt[], now: number, weeks = 7): WeekScore[] {
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    const inWeek = attempts.filter((a) => a.at > start && a.at <= end);
    const mean = inWeek.length > 0 ? inWeek.reduce((s, a) => s + a.score, 0) / inWeek.length : null;
    return { start, mean, count: inWeek.length };
  });
}

/** Days in a row with a finished Daily, ending today, or yesterday while today is still open. */
export function streak(sessions: SessionRecord[], today: string): number {
  const done = new Set(sessions.filter((s) => s.mode === 'daily' && s.finishedAt !== undefined).map((s) => s.date));
  let day = done.has(today) ? today : previousDay(today);
  let count = 0;
  while (done.has(day)) {
    count++;
    day = previousDay(day);
  }
  return count;
}

export interface TopicGroup {
  root: Topic;
  mastery: Mastery | undefined;
  leaves: { topic: Topic; mastery: Mastery | undefined }[];
}

/** Root topics with their leaf topics, as the Library and the topic map show them. */
export function topicGroups(topics: Topic[], mastery: Map<string, Mastery>): TopicGroup[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const rootOf = (t: Topic): string => {
    let current = t;
    for (let parent = current.parent; parent !== null; parent = current.parent) {
      const next = byId.get(parent);
      if (!next) break;
      current = next;
    }
    return current.id;
  };
  const leaves = leafTopics(topics);
  return topics
    .filter((t) => t.parent === null)
    .map((root) => ({
      root,
      mastery: mastery.get(root.id),
      leaves: leaves.filter((t) => rootOf(t) === root.id).map((topic) => ({ topic, mastery: mastery.get(topic.id) })),
    }));
}
```

- [ ] **Step 6: Thay `src/app/sessionService.ts`**

```ts
import type { Content } from '../content/load';
import { grade, type Response } from '../core/grading';
import { masteryByTopic, type Mastery } from '../core/mastery';
import { diagnose, topGaps, type Gap } from '../core/recommend';
import { nextReview } from '../core/scheduler';
import { buildSession, type Duration, type SessionPlan } from '../core/sessionBuilder';
import type { Attempt, Confidence, Lang, ReviewState } from '../core/types';
import type { Repo, SessionRecord, Snapshot } from '../storage/repo';
import { toBackup, type Backup } from './backup';
import { localDate } from './dates';

export { localDate };

export interface AnswerInput {
  sessionId: string;
  itemId: string;
  response: Response;
  confidence: Confidence;
  /** seconds */
  timeSpent: number;
  lang: Lang;
  now: number;
}

export interface Overview {
  daily?: SessionRecord;
  plan: SessionPlan;
  gaps: Gap[];
  misconceptions: { id: string; occurrences: number }[];
}

export interface LoadedSession {
  session: SessionRecord;
  attempts: Attempt[];
}

export interface Stats {
  attempts: Attempt[];
  sessions: SessionRecord[];
  mastery: Map<string, Mastery>;
}

interface History {
  attempts: Attempt[];
  reviews: ReviewState[];
  mastery: Map<string, Mastery>;
}

/** Items in one topic-practice run from the Library or a Lesson. */
export const TOPIC_PRACTICE_LIMIT = 8;

export function createSessionService(repo: Repo, content: Content) {
  const byId = new Map(content.items.map((i) => [i.id, i]));

  async function history(now: number): Promise<History> {
    const [attempts, reviews] = await Promise.all([repo.listAttempts(), repo.listReviews()]);
    return { attempts, reviews, mastery: masteryByTopic(content.topics, attempts, byId, now) };
  }

  /** The first session of a day is the Daily; later ones are practice with their own seed. */
  async function today(now: number) {
    const date = localDate(now);
    const sessions = await repo.findSessions(date);
    const daily = sessions.find((s) => s.mode === 'daily');
    return { date, daily, seed: daily ? `${date}#${sessions.length}` : date };
  }

  function plan(duration: Duration, seed: string, now: number, h: History): SessionPlan {
    return buildSession({ duration, date: seed, now, items: content.items, attempts: h.attempts, reviews: h.reviews, mastery: h.mastery });
  }

  /** A short practice run over chosen items, e.g. a gap's plan from the Result screen. */
  async function startPractice(itemIds: string[], now: number): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: crypto.randomUUID(), date: localDate(now), mode: 'practice', durationMin: 15,
      itemIds, startedAt: now, overtimeSec: 0,
    };
    await repo.putSession(session);
    return session;
  }

  return {
    async overview(duration: Duration, now: number): Promise<Overview> {
      const [{ daily, seed }, h] = await Promise.all([today(now), history(now)]);
      const gaps = topGaps({ topics: content.topics, mastery: h.mastery, items: content.items, lessons: content.lessons, attempts: h.attempts });
      const misconceptions = diagnose(content.topics, h.attempts, byId, now).flatMap((d) =>
        d.code === 'misconception' ? [{ id: d.misconceptionId, occurrences: d.occurrences }] : [],
      );
      return { daily, plan: plan(duration, seed, now, h), gaps, misconceptions };
    },

    async start(duration: Duration, now: number): Promise<SessionRecord> {
      const [{ date, daily, seed }, h] = await Promise.all([today(now), history(now)]);
      const session: SessionRecord = {
        id: crypto.randomUUID(), date, mode: daily ? 'practice' : 'daily', durationMin: duration,
        itemIds: plan(duration, seed, now, h).itemIds, startedAt: now, overtimeSec: 0,
      };
      await repo.putSession(session);
      return session;
    },

    startPractice,

    async startTopicPractice(topicId: string, now: number): Promise<SessionRecord> {
      const itemIds = content.items.filter((i) => i.topics[0] === topicId).slice(0, TOPIC_PRACTICE_LIMIT).map((i) => i.id);
      if (itemIds.length === 0) throw new Error(`No items for topic "${topicId}"`);
      return startPractice(itemIds, now);
    },

    async load(sessionId: string): Promise<LoadedSession | undefined> {
      const session = await repo.getSession(sessionId);
      if (!session) return undefined;
      const attempts = (await repo.listAttempts()).filter((a) => a.sessionId === sessionId);
      return { session, attempts };
    },

    async stats(now: number): Promise<Stats> {
      const [attempts, sessions] = await Promise.all([repo.listAttempts(), repo.listSessions()]);
      return { attempts, sessions, mastery: masteryByTopic(content.topics, attempts, byId, now) };
    },

    listAttempts: () => repo.listAttempts(),
    loadDraft: (challengeId: string) => repo.getDraft(challengeId),
    saveDraft: (challengeId: string, code: string) => repo.putDraft(challengeId, code),

    async exportBackup(now: number): Promise<Backup> {
      return toBackup(await repo.exportAll(), now);
    },
    importBackup: (snapshot: Snapshot) => repo.importAll(snapshot),

    async answer(input: AnswerInput): Promise<Attempt> {
      const { sessionId, itemId, response, confidence, timeSpent, lang, now } = input;
      const item = byId.get(itemId);
      if (!item) throw new Error(`Unknown item "${itemId}"`);
      const { score, misconceptionIds } = grade(item, response);
      const attempt: Attempt = {
        id: crypto.randomUUID(), itemId, sessionId, score, timeSpent, confidence, lang, at: now, misconceptionIds,
        usedHints: response.type === 'challenge' ? response.usedHints : 0,
        ...(response.type === 'challenge' ? { testResults: response.tests } : {}),
      };
      await repo.addAttempt(attempt);
      await repo.putReview(nextReview(await repo.getReview(itemId), itemId, score, confidence, now));
      return attempt;
    },

    async finish(sessionId: string, now: number): Promise<SessionRecord> {
      const session = await repo.getSession(sessionId);
      if (!session) throw new Error(`Unknown session "${sessionId}"`);
      if (session.finishedAt !== undefined) return session;
      const elapsed = Math.round((now - session.startedAt) / 1000);
      const done = { ...session, finishedAt: now, overtimeSec: Math.max(0, elapsed - session.durationMin * 60) };
      await repo.putSession(done);
      return done;
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
```

- [ ] **Step 7: Thêm test** vào cuối `describe('session service', …)` trong `src/app/sessionService.test.ts`, và thêm `import { parseBackup } from './backup';` vào nhóm import của file:

```ts
  it('stats returns sessions, attempts and mastery', async () => {
    const { service } = setup();
    const s = await service.startPractice(['q1'], NOW);
    await service.answer({
      sessionId: s.id, itemId: 'q1', response: { type: 'mcq', selected: [0] },
      confidence: 'sure', timeSpent: 5, lang: 'vi', now: NOW,
    });
    const stats = await service.stats(NOW);
    expect(stats.sessions.map((x) => x.id)).toEqual([s.id]);
    expect(stats.attempts).toHaveLength(1);
    expect(stats.mastery.get('render/memo')?.count).toBe(1);
  });

  it('startTopicPractice uses the topic’s own items and refuses an empty topic', async () => {
    const { service } = setup();
    const s = await service.startTopicPractice('render/memo', NOW);
    expect(s).toMatchObject({ mode: 'practice' });
    expect(s.itemIds).toHaveLength(8);
    await expect(service.startTopicPractice('render', NOW)).rejects.toThrow('No items');
  });

  it('exports a backup that another store can import', async () => {
    const { service } = setup();
    await service.start(30, NOW);
    const backup = await service.exportBackup(NOW);
    const other = setup().service;
    await other.importBackup(parseBackup(JSON.stringify(backup)));
    expect((await other.stats(NOW)).sessions).toEqual(backup.sessions);
  });
```

- [ ] **Step 8: Thay `src/app/router.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { href, parseRoute, type Route } from './router';

describe('router', () => {
  it('falls back to today for empty or unknown hashes', () => {
    expect(parseRoute('')).toEqual({ name: 'today' });
    expect(parseRoute('#/')).toEqual({ name: 'today' });
    expect(parseRoute('#/test')).toEqual({ name: 'today' });
    expect(parseRoute('#/nope/x')).toEqual({ name: 'today' });
    expect(parseRoute('#/test/%E0')).toEqual({ name: 'today' });
  });

  it('parses session routes', () => {
    expect(parseRoute('#/test/abc')).toEqual({ name: 'test', sessionId: 'abc' });
    expect(parseRoute('#/result/a%20b')).toEqual({ name: 'result', sessionId: 'a b' });
  });

  it('parses the library, lesson, progress and settings routes', () => {
    expect(parseRoute('#/library')).toEqual({ name: 'library' });
    expect(parseRoute('#/lesson/render-memo-pitfalls')).toEqual({ name: 'lesson', lessonId: 'render-memo-pitfalls' });
    expect(parseRoute('#/lesson')).toEqual({ name: 'today' });
    expect(parseRoute('#/progress')).toEqual({ name: 'progress' });
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
  });

  it('href round-trips through parseRoute', () => {
    const routes: Route[] = [
      { name: 'today' },
      { name: 'test', sessionId: 'x/y' },
      { name: 'result', sessionId: 'id-1' },
      { name: 'library' },
      { name: 'lesson', lessonId: 'l-1' },
      { name: 'progress' },
      { name: 'settings' },
    ];
    for (const r of routes) expect(parseRoute(href(r))).toEqual(r);
  });
});
```

- [ ] **Step 9: Thay `src/app/router.ts`**

```ts
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'today' }
  | { name: 'test'; sessionId: string }
  | { name: 'result'; sessionId: string }
  | { name: 'library' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'progress' }
  | { name: 'settings' };

const TODAY: Route = { name: 'today' };

function decode(id: string | undefined): string | undefined {
  if (!id) return undefined;
  try {
    return decodeURIComponent(id);
  } catch {
    // a malformed escape such as %E0 falls back to Today instead of crashing the app
    return undefined;
  }
}

export function parseRoute(hash: string): Route {
  const [, name, rawId] = hash.replace(/^#/, '').split('/');
  const id = decode(rawId);
  switch (name) {
    case 'test':
    case 'result':
      return id ? { name, sessionId: id } : TODAY;
    case 'lesson':
      return id ? { name, lessonId: id } : TODAY;
    case 'library':
    case 'progress':
    case 'settings':
      return { name };
    default:
      return TODAY;
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'today':
      return '#/';
    case 'test':
    case 'result':
      return `#/${route.name}/${encodeURIComponent(route.sessionId)}`;
    case 'lesson':
      return `#/lesson/${encodeURIComponent(route.lessonId)}`;
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/app`. Kỳ vọng: sessionService 14, backup 5, progress 5, router 4, report 3, draft 5 đều pass.

---

### Task 3: Theme, tải file, chuỗi, CSS

**Files:** Create `src/ui/theme.ts`, `src/ui/theme.test.ts`, `src/ui/ThemeProvider.tsx`, `src/ui/download.ts`. Modify `src/ui/app.css`, `src/ui/components.tsx`, `src/ui/CodeEditor.tsx`, `src/screens/questions/ChallengeView.tsx`, `src/i18n/strings.ts`

- [ ] **Step 1: Viết test** `src/ui/theme.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { isThemePref, resolveTheme } from './theme';

describe('theme', () => {
  it('resolves system from the OS preference and keeps explicit choices', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('recognises stored preferences', () => {
    expect(isThemePref('light')).toBe(true);
    expect(isThemePref('blue')).toBe(false);
    expect(isThemePref(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Viết `src/ui/theme.ts`**

```ts
export type ThemePref = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

export const THEME_PREFS: ThemePref[] = ['dark', 'light', 'system'];

export function resolveTheme(pref: ThemePref, prefersDark: boolean): Theme {
  if (pref === 'system') return prefersDark ? 'dark' : 'light';
  return pref;
}

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'dark' || value === 'light' || value === 'system';
}
```

- [ ] **Step 3: Viết `src/ui/ThemeProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveTheme, type Theme, type ThemePref } from './theme';

interface ThemeValue {
  pref: ThemePref;
  theme: Theme;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_COLOR: Record<Theme, string> = { dark: '#0a0d0c', light: '#f4f6f4' };

export function ThemeProvider({ initial, onChange, children }: { initial: ThemePref; onChange: (pref: ThemePref) => void; children: ReactNode }) {
  const [pref, setPrefState] = useState(initial);
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onQuery = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onQuery);
    return () => query.removeEventListener('change', onQuery);
  }, []);

  const theme = resolveTheme(pref, prefersDark);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const value = useMemo<ThemeValue>(
    () => ({
      pref,
      theme,
      setPref: (next) => {
        setPrefState(next);
        onChange(next);
      },
    }),
    [pref, theme, onChange],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
```

- [ ] **Step 4: Viết `src/ui/download.ts`**

```ts
/** Saves `data` as a pretty-printed JSON file through a temporary link. */
export function downloadJson(fileName: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 5: `src/ui/components.tsx`**: thêm vào cuối file (component dùng chung cho Result và Progress):

```tsx
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stack" style={{ gap: 0 }}>
      <span className="stat">{value}</span>
      <span className="muted">{label}</span>
    </div>
  );
}
```

- [ ] **Step 6: `src/ui/CodeEditor.tsx`**
  - Trong `definePine`, ngay sau lời gọi `monaco.editor.defineTheme('pine', { … });`, thêm theme light:

```ts
  monaco.editor.defineTheme('pine-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.lineHighlightBackground': '#e3e8e5',
      'editorLineNumber.foreground': '#56615c',
    },
  });
```

  - Đổi chữ ký component thành `export default function CodeEditor({ value, onChange, dark }: { value: string; onChange: (value: string) => void; dark: boolean }) {`
  - Đổi `theme="pine"` thành `theme={dark ? 'pine' : 'pine-light'}`

- [ ] **Step 7: `src/screens/questions/ChallengeView.tsx`**
  - Thêm `import { useTheme } from '../../ui/ThemeProvider';` sau dòng `import { Markdown } from '../../ui/Markdown';`
  - Ngay dưới `const { t } = useLang();`, thêm `const { theme } = useTheme();`
  - Đổi `<CodeEditor value={code} onChange={edit} />` thành `<CodeEditor value={code} onChange={edit} dark={theme === 'dark'} />`

- [ ] **Step 8: `src/ui/app.css`**
  - Trong khối `:root` đầu file, ngay sau dòng `--mastery-solid: #6cb6ff;`, thêm:

```css
  --on-mastery-weak: #e6ebe8;
  --on-mastery-learning: #1f1606;
  --on-mastery-solid: #0d1a26;
```

  - Ngay sau dấu `}` đóng khối `:root` đó, thêm khối light theme:

```css
/* Light theme from the Design System; the app sets data-theme on <html>. */
:root[data-theme="light"] {
  color-scheme: light;
  --surface: #f4f6f4;
  --surface-raised: #ffffff;
  --line: #d5dcd8;
  --ink: #111614;
  --ink-muted: #56615c;
  --accent: #1b6b54;
  --on-accent: #ffffff;
  --accent-ink: #1b6b54;
  --correct: #1d64b0;
  --wrong: #b93a2b;
  --mastery-none: #e3e8e5;
  --mastery-weak: #f2b8ac;
  --mastery-learning: #d19a2a;
  --mastery-solid: #1d64b0;
  --on-mastery-weak: #111614;
  --on-mastery-learning: #111614;
  --on-mastery-solid: #ffffff;
}
```

  - Đổi dòng `.nav { display: flex; gap: var(--space-4); flex-grow: 1; }` thành `.nav { display: flex; gap: var(--space-4); flex-grow: 1; flex-wrap: wrap; }`
  - Thêm vào ngay trước khối `@media (max-width: 720px) {`:

```css
/* Library, Lesson, Progress, Settings */
.narrow { max-width: 760px; }
.topics { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-3); }
.progress { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: var(--space-5); align-items: start; }
.week-chart { display: flex; align-items: flex-end; gap: 10px; height: 96px; }
.week-bar { flex: 1 1 0; border-radius: var(--radius-sm) var(--radius-sm) 0 0; background: var(--line); }
.week-bar.current { background: var(--accent-ink); }
.week-bar.empty { background: var(--mastery-none); }
.legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--ink-muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.swatch { width: 12px; height: 12px; border-radius: 2px; }
.map-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-2); }
.cell { display: flex; flex-direction: column; justify-content: space-between; gap: var(--space-1); min-height: 64px; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 13px; line-height: 17px; }
.cell-none { background: var(--mastery-none); border: 1px solid var(--line); color: var(--ink); }
.cell-weak { background: var(--mastery-weak); color: var(--on-mastery-weak); }
.cell-learning { background: var(--mastery-learning); color: var(--on-mastery-learning); }
.cell-solid { background: var(--mastery-solid); color: var(--on-mastery-solid); }
.file-input { font: inherit; color: var(--ink-muted); }
@media (max-width: 900px) {
  .progress { grid-template-columns: minmax(0, 1fr); }
}
```

- [ ] **Step 9: `src/i18n/strings.ts`**: thêm các key sau ngay trước `} satisfies Record<string, Localized>;`

```ts
  library: { vi: 'Thư viện', en: 'Library' },
  progress: { vi: 'Tiến độ', en: 'Progress' },
  settings: { vi: 'Cài đặt', en: 'Settings' },
  libraryTitle: { vi: 'Thư viện chủ đề', en: 'Topic library' },
  practiseTopic: { vi: 'Luyện chủ đề này', en: 'Practise this topic' },
  itemCount: { vi: '{q} câu hỏi · {c} challenge', en: '{q} questions · {c} challenges' },
  lessonLink: { vi: 'Bài học: {kind} · {m} phút', en: 'Lesson: {kind} · {m} min' },
  minutes: { vi: '{m} phút', en: '{m} min' },
  backLibrary: { vi: '← Thư viện', en: '← Library' },
  progressTitle: { vi: 'Tiến độ', en: 'Progress' },
  readiness: { vi: 'Sẵn sàng phỏng vấn', en: 'Interview readiness' },
  notEnough: { vi: 'chưa đủ dữ liệu', en: 'not enough data' },
  weeklyTitle: { vi: 'Điểm trung bình {n} tuần', en: 'Average score, last {n} weeks' },
  weekLabel: { vi: 'T{n}', en: 'W{n}' },
  streakLabel: { vi: 'ngày liên tiếp', en: 'days in a row' },
  answersLabel: { vi: 'câu đã trả lời', en: 'answers' },
  mapTitle: { vi: 'Bản đồ chủ đề', en: 'Topic map' },
  legendNone: { vi: 'chưa đủ dữ liệu', en: 'not enough data' },
  legendWeak: { vi: 'yếu', en: 'weak' },
  legendLearning: { vi: 'đang học', en: 'learning' },
  legendSolid: { vi: 'vững', en: 'solid' },
  attemptsCount: { vi: '{n} lần', en: '{n} tries' },
  loadFailed: { vi: 'Không đọc được dữ liệu. Tải lại trang để thử lại.', en: 'Could not read your data. Reload the page to try again.' },
  settingsTitle: { vi: 'Cài đặt', en: 'Settings' },
  themeTitle: { vi: 'Giao diện', en: 'Appearance' },
  theme_dark: { vi: 'Tối', en: 'Dark' },
  theme_light: { vi: 'Sáng', en: 'Light' },
  theme_system: { vi: 'Theo hệ thống', en: 'Match system' },
  languageTitle: { vi: 'Ngôn ngữ', en: 'Language' },
  lang_vi: { vi: 'Tiếng Việt', en: 'Tiếng Việt' },
  lang_en: { vi: 'English', en: 'English' },
  backupTitle: { vi: 'Sao lưu', en: 'Backup' },
  backupHelp: {
    vi: 'Dữ liệu chỉ nằm trong trình duyệt này. Tải bản sao lưu định kỳ để không mất tiến độ.',
    en: 'Your data lives only in this browser. Download a backup now and then so you do not lose progress.',
  },
  exportButton: { vi: 'Tải bản sao lưu', en: 'Download backup' },
  importLabel: { vi: 'Khôi phục từ file sao lưu', en: 'Restore from a backup file' },
  importConfirm: {
    vi: 'Sẽ thay toàn bộ dữ liệu hiện tại bằng {s} bài và {a} câu trả lời trong file. Bản hiện tại được tải về trước.',
    en: 'This replaces all current data with the {s} sessions and {a} answers in the file. The current data is downloaded first.',
  },
  importRun: { vi: 'Thay dữ liệu', en: 'Replace data' },
  cancel: { vi: 'Huỷ', en: 'Cancel' },
  importFailed: { vi: 'Không đọc được file: {reason}', en: 'Could not read the file: {reason}' },
  exported: { vi: 'Đã tải bản sao lưu.', en: 'Backup downloaded.' },
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/ui/theme.test.ts`. Kỳ vọng: 2 test pass.

---

### Task 4: Các màn mới và nối App

**Files:** Replace `src/ui/Chrome.tsx`, `src/App.tsx`. Create `src/screens/LibraryScreen.tsx`, `src/screens/LessonScreen.tsx`, `src/screens/ProgressScreen.tsx`, `src/screens/SettingsScreen.tsx`. Modify `src/screens/ResultScreen.tsx`

- [ ] **Step 1: Thay `src/ui/Chrome.tsx`**

```tsx
import { href, type Route } from '../app/router';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { Button } from './components';
import { otherLang } from './format';

const NAV: { name: 'today' | 'library' | 'progress' | 'settings'; label: UiKey }[] = [
  { name: 'today', label: 'today' },
  { name: 'library', label: 'library' },
  { name: 'progress', label: 'progress' },
  { name: 'settings', label: 'settings' },
];

export function TopBar({ route }: { route: Route }) {
  const { lang, setLang, t } = useLang();
  const section = route.name === 'lesson' ? 'library' : route.name === 'result' ? 'today' : route.name;
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: 'today' })}>RN Interview Prep</a>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n.name} href={href({ name: n.name })} aria-current={section === n.name ? 'page' : undefined}>
            {t(n.label)}
          </a>
        ))}
      </nav>
      <Button className="btn-small" onClick={() => setLang(otherLang(lang))}>VI ⇄ EN</Button>
    </header>
  );
}

export function StorageBanner() {
  const { t } = useLang();
  return <p role="alert" className="banner">{t('storageBanner')}</p>;
}

export function NotFound() {
  const { t } = useLang();
  return (
    <main className="page stack">
      <p>{t('notFound')}</p>
      <a href={href({ name: 'today' })}>{t('backToday')}</a>
    </main>
  );
}
```

- [ ] **Step 2: Viết `src/screens/LibraryScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { topicGroups } from '../app/progress';
import { href, navigate } from '../app/router';
import type { SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import type { Mastery } from '../core/mastery';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { Button, MasteryBar } from '../ui/components';
import { formatScore } from '../ui/format';

export function LibraryScreen({ service, content }: { service: SessionService; content: Content }) {
  const { t, pick } = useLang();
  const [mastery, setMastery] = useState<Map<string, Mastery>>(() => new Map());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    service.stats(Date.now()).then(
      (stats) => {
        if (live) setMastery(stats.mastery);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [service]);

  async function practise(topicId: string) {
    setBusy(true);
    setFailed(false);
    try {
      const session = await service.startTopicPractice(topicId, Date.now());
      navigate({ name: 'test', sessionId: session.id });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <main className="page stack" style={{ gap: 'var(--space-5)' }}>
      <h1 className="display">{t('libraryTitle')}</h1>
      {failed ? <p role="alert" className="muted down">{t('saveFailed')}</p> : null}
      {topicGroups(content.topics, mastery).map((group) => (
        <section key={group.root.id} className="stack">
          <h2 className="title">{pick(group.root.title)}</h2>
          <div className="topics">
            {group.leaves.map(({ topic, mastery: m }) => {
              const items = content.items.filter((i) => i.topics[0] === topic.id);
              const challenges = items.filter((i) => i.type === 'challenge').length;
              const lessons = content.lessons.filter((l) => l.topic === topic.id);
              const known = m !== undefined && m.value !== null && m.level !== 'insufficient';
              return (
                <article key={topic.id} className="panel stack" style={{ gap: 'var(--space-2)' }}>
                  <div className="row between">
                    <span style={{ fontWeight: 600 }}>{pick(topic.title)}</span>
                    <span className="num muted">{known && m.value !== null ? formatScore(m.value) : t('notEnough')}</span>
                  </div>
                  <MasteryBar value={m?.value ?? null} level={m?.level ?? 'insufficient'} />
                  <span className="muted">{t('itemCount', { q: items.length - challenges, c: challenges })}</span>
                  {lessons.map((l) => (
                    <a key={l.id} href={href({ name: 'lesson', lessonId: l.id })}>
                      {t('lessonLink', { kind: t(`kind_${l.kind}` as UiKey), m: l.readMinutes })}
                    </a>
                  ))}
                  {items.length > 0 ? (
                    <Button className="btn-small" disabled={busy} onClick={() => void practise(topic.id)}>{t('practiseTopic')}</Button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 3: Viết `src/screens/LessonScreen.tsx`**

```tsx
import { useState } from 'react';
import { href, navigate } from '../app/router';
import type { SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { NotFound } from '../ui/Chrome';
import { Button } from '../ui/components';
import { Markdown } from '../ui/Markdown';

export function LessonScreen({ service, content, lessonId }: { service: SessionService; content: Content; lessonId: string }) {
  const { t, pick } = useLang();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const lesson = content.lessons.find((l) => l.id === lessonId);
  if (!lesson) return <NotFound />;

  const topicId = lesson.topic;
  const topic = content.topics.find((x) => x.id === topicId);
  const hasItems = content.items.some((i) => i.topics[0] === topicId);

  const practise = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const session = await service.startTopicPractice(topicId, Date.now());
      navigate({ name: 'test', sessionId: session.id });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <main className="page narrow stack" style={{ gap: 'var(--space-4)' }}>
      <a href={href({ name: 'library' })}>{t('backLibrary')}</a>
      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <span className="label">{t(`kind_${lesson.kind}` as UiKey)} · {t('minutes', { m: lesson.readMinutes })}</span>
        <h1 className="display">{topic ? pick(topic.title) : topicId}</h1>
      </div>
      <Markdown source={pick(lesson.body)} />
      {hasItems ? (
        <div className="row">
          <Button variant="primary" disabled={busy} onClick={() => void practise()}>{t('practiseTopic')}</Button>
        </div>
      ) : null}
      {failed ? <p role="alert" className="muted down">{t('saveFailed')}</p> : null}
    </main>
  );
}
```

- [ ] **Step 4: Viết `src/screens/ProgressScreen.tsx`** (mockup màn 5)

```tsx
import { useEffect, useState } from 'react';
import { localDate } from '../app/dates';
import { streak, topicGroups, weeklyScores } from '../app/progress';
import type { SessionService, Stats } from '../app/sessionService';
import type { Content } from '../content/load';
import type { Level } from '../core/mastery';
import { useLang } from '../i18n/LangProvider';
import { MasteryBar, Stat } from '../ui/components';
import { formatScore } from '../ui/format';

const CELL: Record<Level, string> = { insufficient: 'cell-none', weak: 'cell-weak', learning: 'cell-learning', solid: 'cell-solid' };

export function ProgressScreen({ service, content }: { service: SessionService; content: Content }) {
  const { t, pick } = useLang();
  const [stats, setStats] = useState<Stats | null>();

  useEffect(() => {
    let live = true;
    service.stats(Date.now()).then(
      (s) => {
        if (live) setStats(s);
      },
      () => {
        if (live) setStats(null);
      },
    );
    return () => {
      live = false;
    };
  }, [service]);

  if (stats === undefined) return <p className="page muted">{t('loading')}</p>;
  if (stats === null) return <p role="alert" className="page muted down">{t('loadFailed')}</p>;

  const now = Date.now();
  const groups = topicGroups(content.topics, stats.mastery);
  const weeks = weeklyScores(stats.attempts, now);
  const last = weeks[weeks.length - 1];
  const days = streak(stats.sessions, localDate(now));

  return (
    <main className="page stack" style={{ gap: 'var(--space-5)' }}>
      <div className="row between">
        <h1 className="display">{t('progressTitle')}</h1>
        <div className="row" style={{ gap: 'var(--space-5)' }}>
          <Stat value={String(days)} label={t('streakLabel')} />
          <Stat value={String(stats.attempts.length)} label={t('answersLabel')} />
        </div>
      </div>

      <div className="progress">
        <section className="stack">
          <h2 className="title">{t('readiness')}</h2>
          {groups.map((g) => {
            const value = g.mastery && g.mastery.level !== 'insufficient' ? g.mastery.value : null;
            return (
              <div key={g.root.id} className="stack" style={{ gap: 6 }}>
                <div className="row between">
                  <span>{pick(g.root.title)}</span>
                  {value !== null ? <span className="num">{formatScore(value)}</span> : <span className="muted">{t('notEnough')}</span>}
                </div>
                <MasteryBar value={g.mastery?.value ?? null} level={g.mastery?.level ?? 'insufficient'} />
              </div>
            );
          })}

          <div className="card stack">
            <span className="label">{t('weeklyTitle', { n: weeks.length })}</span>
            <div className="week-chart">
              {weeks.map((w, i) => (
                <div
                  key={w.start}
                  className={w.mean === null ? 'week-bar empty' : i === weeks.length - 1 ? 'week-bar current' : 'week-bar'}
                  style={{ height: `${Math.max(4, Math.round((w.mean ?? 0) * 100))}%` }}
                  title={w.mean === null ? t('notEnough') : formatScore(w.mean)}
                />
              ))}
            </div>
            <div className="row between num muted">
              <span>{t('weekLabel', { n: 1 })}</span>
              <span>
                {t('weekLabel', { n: weeks.length })}
                {last.mean !== null ? ` · ${formatScore(last.mean)}` : ''}
              </span>
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="row between">
            <h2 className="title">{t('mapTitle')}</h2>
            <div className="legend">
              <span><span className="swatch cell-none" />{t('legendNone')}</span>
              <span><span className="swatch cell-weak" />{t('legendWeak')}</span>
              <span><span className="swatch cell-learning" />{t('legendLearning')}</span>
              <span><span className="swatch cell-solid" />{t('legendSolid')}</span>
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.root.id} className="stack" style={{ gap: 6 }}>
              <span className="label">{pick(g.root.title)}</span>
              <div className="map-grid">
                {g.leaves.map(({ topic, mastery }) => {
                  const level = mastery?.level ?? 'insufficient';
                  const value = mastery && level !== 'insufficient' ? mastery.value : null;
                  return (
                    <div key={topic.id} className={`cell ${CELL[level]}`}>
                      <span>{pick(topic.title)}</span>
                      <span className="num">{value !== null ? formatScore(value) : t('attemptsCount', { n: mastery?.count ?? 0 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Viết `src/screens/SettingsScreen.tsx`**

```tsx
import { useState, type ChangeEvent } from 'react';
import { backupFileName, parseBackup } from '../app/backup';
import { href } from '../app/router';
import type { SessionService } from '../app/sessionService';
import type { Lang } from '../core/types';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import type { Snapshot } from '../storage/repo';
import { Button } from '../ui/components';
import { downloadJson } from '../ui/download';
import { THEME_PREFS } from '../ui/theme';
import { useTheme } from '../ui/ThemeProvider';

const LANGS: Lang[] = ['vi', 'en'];

export function SettingsScreen({ service }: { service: SessionService }) {
  const { lang, setLang, t } = useLang();
  const { pref, setPref } = useTheme();
  const [pending, setPending] = useState<Snapshot>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  async function downloadBackup() {
    const backup = await service.exportBackup(Date.now());
    downloadJson(backupFileName(backup.exportedAt), backup);
  }

  async function exportNow() {
    setMessage(undefined);
    try {
      await downloadBackup();
      setMessage({ ok: true, text: t('exported') });
    } catch {
      setMessage({ ok: false, text: t('saveFailed') });
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage(undefined);
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setPending(undefined);
      setMessage({ ok: false, text: t('importFailed', { reason: e instanceof Error ? e.message : String(e) }) });
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      await downloadBackup();
      await service.importBackup(pending);
      // restart so language, theme and every screen read the restored data
      window.location.hash = href({ name: 'today' });
      window.location.reload();
    } catch {
      setMessage({ ok: false, text: t('saveFailed') });
      setBusy(false);
    }
  }

  return (
    <main className="page narrow stack" style={{ gap: 'var(--space-5)' }}>
      <h1 className="display">{t('settingsTitle')}</h1>

      <section className="stack">
        <h2 className="title">{t('themeTitle')}</h2>
        <div role="radiogroup" aria-label={t('themeTitle')} className="row" style={{ gap: 'var(--space-2)' }}>
          {THEME_PREFS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={pref === p} className="pill" onClick={() => setPref(p)}>
              {t(`theme_${p}` as UiKey)}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="title">{t('languageTitle')}</h2>
        <div role="radiogroup" aria-label={t('languageTitle')} className="row" style={{ gap: 'var(--space-2)' }}>
          {LANGS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={lang === l} className="pill" onClick={() => setLang(l)}>
              {t(`lang_${l}` as UiKey)}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="title">{t('backupTitle')}</h2>
        <p className="lead">{t('backupHelp')}</p>
        <div className="row">
          <Button onClick={() => void exportNow()}>{t('exportButton')}</Button>
        </div>
        <label className="stack" style={{ gap: 'var(--space-2)' }} htmlFor="backup-file">
          <span className="muted">{t('importLabel')}</span>
          <input id="backup-file" type="file" accept="application/json,.json" className="file-input" onChange={(e) => void onFile(e)} />
        </label>
        {pending ? (
          <div className="panel stack" style={{ gap: 'var(--space-3)' }}>
            <p style={{ margin: 0 }}>{t('importConfirm', { s: pending.sessions.length, a: pending.attempts.length })}</p>
            <div className="row">
              <Button variant="primary" disabled={busy} onClick={() => void confirmImport()}>{t('importRun')}</Button>
              <Button disabled={busy} onClick={() => setPending(undefined)}>{t('cancel')}</Button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'muted up' : 'muted down'}>{message.text}</p>
        ) : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: `src/screens/ResultScreen.tsx`**
  - Xoá function `Stat` cục bộ (toàn bộ khối `function Stat({ value, label }: …) { … }`).
  - Đổi dòng import `import { Button, Rich } from '../ui/components';` thành `import { Button, Rich, Stat } from '../ui/components';`
  - Trong `<ol className="steps">`, đổi dòng `{stepText(s)} <span className="num muted">{s.minutes}'</span>` thành:

```tsx
                      {s.kind === 'read' ? <a href={href({ name: 'lesson', lessonId: s.lessonId })}>{stepText(s)}</a> : stepText(s)}{' '}
                      <span className="num muted">{s.minutes}'</span>
```

- [ ] **Step 7: Thay `src/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useRoute } from './app/router';
import { createSessionService, type SessionService } from './app/sessionService';
import { content } from './content';
import type { Lang } from './core/types';
import { LangProvider } from './i18n/LangProvider';
import { LessonScreen } from './screens/LessonScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TestScreen } from './screens/TestScreen';
import { TodayScreen } from './screens/TodayScreen';
import { openRepo } from './storage/openRepo';
import { createMemoryRepo, type Repo } from './storage/repo';
import { StorageBanner, TopBar } from './ui/Chrome';
import { isThemePref, type ThemePref } from './ui/theme';
import { ThemeProvider } from './ui/ThemeProvider';

interface Booted {
  repo: Repo;
  persistent: boolean;
  lang: Lang;
  theme: ThemePref;
  service: SessionService;
}

export function App() {
  const route = useRoute();
  const [boot, setBoot] = useState<Booted>();

  useEffect(() => {
    let live = true;
    const ready = (repo: Repo, persistent: boolean, lang: Lang, theme: ThemePref) => {
      if (live) setBoot({ repo, persistent, lang, theme, service: createSessionService(repo, content) });
    };
    void openRepo()
      .then(async ({ repo, persistent }) => {
        const [lang, theme] = await Promise.all([repo.getSetting<Lang>('lang'), repo.getSetting<unknown>('theme')]);
        ready(repo, persistent, lang ?? 'vi', isThemePref(theme) ? theme : 'dark');
      })
      .catch(() => ready(createMemoryRepo(), false, 'vi', 'dark'));
    return () => {
      live = false;
    };
  }, []);

  const saveLang = useCallback(
    (lang: Lang) => {
      void boot?.repo.setSetting('lang', lang);
    },
    [boot],
  );
  const saveTheme = useCallback(
    (theme: ThemePref) => {
      void boot?.repo.setSetting('theme', theme);
    },
    [boot],
  );

  if (!boot) return null;
  const { service } = boot;

  return (
    <ThemeProvider initial={boot.theme} onChange={saveTheme}>
      <LangProvider initial={boot.lang} onChange={saveLang}>
        {route.name !== 'test' ? <TopBar route={route} /> : null}
        {!boot.persistent ? <StorageBanner /> : null}
        {route.name === 'today' ? <TodayScreen service={service} content={content} /> : null}
        {route.name === 'test' ? <TestScreen key={route.sessionId} service={service} content={content} sessionId={route.sessionId} /> : null}
        {route.name === 'result' ? <ResultScreen key={route.sessionId} service={service} content={content} sessionId={route.sessionId} /> : null}
        {route.name === 'library' ? <LibraryScreen service={service} content={content} /> : null}
        {route.name === 'lesson' ? <LessonScreen key={route.lessonId} service={service} content={content} lessonId={route.lessonId} /> : null}
        {route.name === 'progress' ? <ProgressScreen service={service} content={content} /> : null}
        {route.name === 'settings' ? <SettingsScreen service={service} /> : null}
      </LangProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Checkpoint (Warren):** `npm run dev`
  - Menu có 4 mục, và mục đang mở được tô màu.
  - Thư viện: mở bài học, rồi bấm "Luyện chủ đề này".
  - Tiến độ: sau một bài, thấy bản đồ chủ đề và cột tuần hiện tại.
  - Cài đặt: đổi theme Sáng, Tối, Theo hệ thống (editor Monaco đổi theo). Tải bản sao lưu, rồi khôi phục chính file đó: trình duyệt tải thêm một bản sao lưu nữa, sau đó trang tải lại.

---

### Task 5: Kiểm chứng toàn phase

```bash
cd ~/Downloads/rn-interview-prep && npm run check
```

Kỳ vọng: `tsc` không lỗi, Vitest báo **154 test pass trên 23 file**. Trong đó 134 test của P3 và 20 test mới:

| File test | Test mới |
|---|---|
| repo | +4 (2 × memory, 2 × dexie) |
| backup | 5 |
| progress | 5 |
| router | +1 |
| sessionService | +3 |
| theme | 2 |
