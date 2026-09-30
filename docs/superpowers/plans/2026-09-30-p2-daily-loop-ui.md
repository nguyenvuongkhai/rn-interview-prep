# P2 Daily Loop UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Quy tắc của chủ project:**
> - **Không chạy build/test/dev server** (`npm test`, `vitest`, `tsc`, `vite`). Mỗi task kết thúc bằng Checkpoint để Warren chạy.
> - Controller (không phải subagent) commit + push sau mỗi nhóm task, message **1 dòng** `P2: <việc đã làm>`.
> - Được chạy `npm install` ở Task 0.

**Goal:** Luồng hằng ngày dùng được trong trình duyệt: **Hôm nay → Làm bài → Kết quả**, lưu tiến độ trong IndexedDB, giao diện theo Design System pine green và mockup.

**Architecture:**
- `src/storage/` là nơi duy nhất đụng IndexedDB (Dexie). Nó có một interface `Repo` với 2 bản: Dexie cho dùng thật, và bản memory cho test và cho khi trình duyệt chặn storage.
- `src/app/` là lớp ứng dụng: `sessionService` ghép `core/` với `Repo`; `report`, `draft`, `router` là hàm thuần.
- `src/screens/` + `src/ui/` là React, chỉ gọi `sessionService` và các hàm thuần.
- Chuỗi giao diện song ngữ nằm trong `src/i18n/`.

**Tech Stack:** P1 stack + Dexie 4, fake-indexeddb 6 (chỉ để test).

**Tham chiếu:**
- Spec: `docs/superpowers/specs/2026-09-30-rn-interview-prep-design.md`
- Design System: https://claude.ai/artifact/PAAJZYEC6qVDbM1FkgPbD1
- Mockup: https://claude.ai/artifact/1fEWFdoWtZgy11ykUj2uXd (màn 1, 2, 4)

**Trong P2 / để sau:**
- Có: Hôm nay, Làm bài (mcq, spot-bug, open), Kết quả, lưu trữ, VI/EN.
- Để sau: challenge chưa được đưa vào bài vì chưa có runner (P3). Thư viện, Lesson, Tiến độ, streak, export/import JSON, light theme là P4.

**Quyết định từ review P1 (đã chốt trong plan này):** chẩn đoán "hiểu sai khái niệm" và "challenge fail theo category" chỉ đếm trong **30 ngày gần nhất**.

---

## File structure

```
src/
├── core/recommend.ts (+ test)        # sửa: cửa sổ 30 ngày
├── core/schema.ts                    # sửa: export type Option
├── storage/
│   ├── repo.ts (+ repo.test.ts)      # SessionRecord, Repo, createMemoryRepo
│   ├── dexieRepo.ts                  # createDb, createDexieRepo
│   └── openRepo.ts                   # Dexie, hoặc memory nếu bị chặn
├── app/
│   ├── sessionService.ts (+ test)    # overview, start, startPractice, load, answer, finish
│   ├── report.ts (+ test)            # buildReport, misconceptionText
│   ├── draft.ts (+ test)             # Draft → Response
│   └── router.ts (+ test)            # hash route
├── i18n/
│   ├── strings.ts                    # chuỗi UI VI/EN
│   └── LangProvider.tsx              # context, t(), pick()
├── ui/
│   ├── app.css                       # token pine green + class component
│   ├── format.ts (+ test)            # formatClock, formatScore, format, otherLang
│   ├── useNow.ts
│   ├── components.tsx                # Button, Chip, Rich, MasteryBar, Segments
│   └── Chrome.tsx                    # TopBar, StorageBanner, NotFound
├── screens/
│   ├── TodayScreen.tsx
│   ├── TestScreen.tsx
│   ├── ResultScreen.tsx
│   └── questions/{McqView,SpotBugView,OpenView}.tsx
├── App.tsx                           # thay: boot repo + route
└── main.tsx                          # sửa: import app.css
index.html                            # sửa: font Google
```

---

### Task 0: Dependency

- [ ] **Step 1:** Branch `P2-0.2.0-P2-RIP-ui-daily-loop` đã được controller cắt. Kiểm tra: `git branch --show-current`.
- [ ] **Step 2: Cài package**

```bash
cd ~/Downloads/rn-interview-prep && npm install dexie@^4 && npm install -D fake-indexeddb@^6
```

---

### Task 1: Cửa sổ 30 ngày cho chẩn đoán lặp lại

**Files:** Modify `src/core/recommend.ts`, `src/core/recommend.test.ts`

- [ ] **Step 1: Thêm test** vào cuối `describe('diagnose', …)` trong `src/core/recommend.test.ts`, và đổi dòng import `import type { TestResult } from './types';` thành `import { DAY_MS, type TestResult } from './types';`

```ts
  it('ignores misconceptions older than 30 days', () => {
    const items = [mcq('m1'), mcq('m2')];
    const attempts = [
      attempt('m1', { score: 0, misconceptionIds: ['stale'], at: NOW - 31 * DAY_MS }),
      attempt('m2', { score: 0, misconceptionIds: ['stale'] }),
    ];
    expect(diagnose(topics, attempts, indexById(items), NOW).some((d) => d.code === 'misconception')).toBe(false);
  });
```

- [ ] **Step 2: Sửa `src/core/recommend.ts`**
  - Đổi `import type { Attempt } from './types';` thành `import { DAY_MS, type Attempt } from './types';`
  - Thêm `windowDays: 30,` vào cuối object `RULES` (sau `minRepeat: 2,`).
  - Trong `diagnose`, thay vòng lặp đếm:

```ts
  const categoryFailures = new Map<string, number>();
  const misconceptions = new Map<string, number>();
  const since = now - RULES.windowDays * DAY_MS;
  for (const a of attempts) {
    if (a.at < since) continue;
    // each counts once per attempt
    countBy(new Set((a.testResults ?? []).filter((r) => !r.pass).map((r) => r.category)), categoryFailures);
    countBy(new Set(a.misconceptionIds), misconceptions);
  }
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/core/recommend.test.ts`. Kỳ vọng: 9 test pass.

---

### Task 2: Storage

**Files:** Create `src/storage/repo.ts`, `src/storage/dexieRepo.ts`, `src/storage/openRepo.ts`, test `src/storage/repo.test.ts`

- [ ] **Step 1: Viết test** `src/storage/repo.test.ts` (chạy cùng bộ test cho cả 2 bản)

```ts
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { NOW, attempt } from '../core/testFixtures';
import { createDb, createDexieRepo } from './dexieRepo';
import { createMemoryRepo, type Repo, type SessionRecord } from './repo';

const session = (id: string, date: string): SessionRecord => ({
  id, date, mode: 'daily', durationMin: 30, itemIds: ['q1'], startedAt: NOW, overtimeSec: 0,
});

describe.each<[string, () => Repo]>([
  ['memory', () => createMemoryRepo()],
  ['dexie', () => createDexieRepo(createDb(`test-${crypto.randomUUID()}`))],
])('%s repo', (_name, make) => {
  it('stores sessions and finds them by date', async () => {
    const repo = make();
    await repo.putSession(session('a', '2026-09-30'));
    await repo.putSession(session('b', '2026-10-01'));
    await repo.putSession({ ...session('a', '2026-09-30'), finishedAt: NOW });
    expect((await repo.getSession('a'))?.finishedAt).toBe(NOW);
    expect((await repo.findSessions('2026-09-30')).map((s) => s.id)).toEqual(['a']);
    expect(await repo.getSession('zzz')).toBeUndefined();
  });

  it('lists attempts oldest first', async () => {
    const repo = make();
    await repo.addAttempt(attempt('q2', { id: 'late', at: NOW + 10 }));
    await repo.addAttempt(attempt('q1', { id: 'early', at: NOW }));
    expect((await repo.listAttempts()).map((a) => a.id)).toEqual(['early', 'late']);
  });

  it('upserts reviews by item', async () => {
    const repo = make();
    await repo.putReview({ itemId: 'q1', box: 0, dueAt: 1 });
    await repo.putReview({ itemId: 'q1', box: 2, dueAt: 2 });
    expect(await repo.listReviews()).toEqual([{ itemId: 'q1', box: 2, dueAt: 2 }]);
    expect(await repo.getReview('q1')).toEqual({ itemId: 'q1', box: 2, dueAt: 2 });
  });

  it('round-trips settings', async () => {
    const repo = make();
    expect(await repo.getSetting('lang')).toBeUndefined();
    await repo.setSetting('lang', 'en');
    expect(await repo.getSetting<string>('lang')).toBe('en');
  });
});
```

- [ ] **Step 2: Viết `src/storage/repo.ts`**

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

/** The only door to persisted data. Two implementations: Dexie (real) and memory (tests, blocked storage). */
export interface Repo {
  getSession(id: string): Promise<SessionRecord | undefined>;
  putSession(session: SessionRecord): Promise<void>;
  findSessions(date: string): Promise<SessionRecord[]>;
  /** oldest first */
  listAttempts(): Promise<Attempt[]>;
  addAttempt(attempt: Attempt): Promise<void>;
  listReviews(): Promise<ReviewState[]>;
  getReview(itemId: string): Promise<ReviewState | undefined>;
  putReview(review: ReviewState): Promise<void>;
  getSetting<T>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: unknown): Promise<void>;
}

export function createMemoryRepo(): Repo {
  const sessions = new Map<string, SessionRecord>();
  const attempts: Attempt[] = [];
  const reviews = new Map<string, ReviewState>();
  const settings = new Map<string, unknown>();
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
    async listAttempts() {
      return [...attempts].sort((a, b) => a.at - b.at);
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
    async getSetting<T>(key: string) {
      return settings.get(key) as T | undefined;
    },
    async setSetting(key, value) {
      settings.set(key, value);
    },
  };
}
```

- [ ] **Step 3: Viết `src/storage/dexieRepo.ts`**

Dùng kiểu intersection chứ không subclass Dexie: target ES2022 bật `useDefineForClassFields`, nên một class field khai báo `sessions!: Table` sẽ ghi đè bảng mà Dexie đã gắn trong constructor.

```ts
import Dexie, { type Table } from 'dexie';
import type { Attempt, ReviewState } from '../core/types';
import type { Repo, SessionRecord } from './repo';

export type AppDb = Dexie & {
  sessions: Table<SessionRecord, string>;
  attempts: Table<Attempt, string>;
  reviews: Table<ReviewState, string>;
  settings: Table<{ key: string; value: unknown }, string>;
};

export function createDb(name = 'rn-interview-prep'): AppDb {
  const db = new Dexie(name) as AppDb;
  db.version(1).stores({
    sessions: 'id, date',
    attempts: 'id, sessionId, itemId, at',
    reviews: 'itemId',
    settings: 'key',
  });
  return db;
}

export function createDexieRepo(db: AppDb): Repo {
  return {
    getSession: (id) => db.sessions.get(id),
    putSession: async (session) => {
      await db.sessions.put(session);
    },
    findSessions: (date) => db.sessions.where('date').equals(date).toArray(),
    listAttempts: () => db.attempts.orderBy('at').toArray(),
    addAttempt: async (attempt) => {
      await db.attempts.add(attempt);
    },
    listReviews: () => db.reviews.toArray(),
    getReview: (itemId) => db.reviews.get(itemId),
    putReview: async (review) => {
      await db.reviews.put(review);
    },
    getSetting: async <T>(key: string) => (await db.settings.get(key))?.value as T | undefined,
    setSetting: async (key, value) => {
      await db.settings.put({ key, value });
    },
  };
}
```

- [ ] **Step 4: Viết `src/storage/openRepo.ts`**

```ts
import { createDb, createDexieRepo } from './dexieRepo';
import { createMemoryRepo, type Repo } from './repo';

/** IndexedDB when the browser allows it; otherwise memory, and the UI warns that progress will not persist. */
export async function openRepo(): Promise<{ repo: Repo; persistent: boolean }> {
  try {
    const db = createDb();
    await db.open();
    return { repo: createDexieRepo(db), persistent: true };
  } catch {
    return { repo: createMemoryRepo(), persistent: false };
  }
}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/storage`. Kỳ vọng: 8 test pass (4 × memory, 4 × dexie).

---

### Task 3: Session service

**Files:** Create `src/app/sessionService.ts`, test `src/app/sessionService.test.ts`

- [ ] **Step 1: Viết test** `src/app/sessionService.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Content } from '../content/load';
import { NOW, challenge, mcq, open, topic } from '../core/testFixtures';
import { DAY_MS } from '../core/types';
import { createMemoryRepo } from '../storage/repo';
import { createSessionService, localDate } from './sessionService';

const content: Content = {
  topics: [topic('render'), topic('render/memo', 'render')],
  items: [...Array.from({ length: 12 }, (_, i) => mcq(`q${i}`)), open('o1'), challenge('ch1')],
  lessons: [],
};

function setup() {
  const repo = createMemoryRepo();
  return { repo, service: createSessionService(repo, content) };
}

describe('localDate', () => {
  it('uses the local calendar day', () => {
    expect(localDate(new Date(2026, 8, 30, 23, 30).getTime())).toBe('2026-09-30');
  });
});

describe('session service', () => {
  it('starts the daily session first, then practice sessions', async () => {
    const { service } = setup();
    const first = await service.start(30, NOW);
    const second = await service.start(30, NOW + 1000);
    expect(first).toMatchObject({ mode: 'daily', date: localDate(NOW), durationMin: 30 });
    expect(second.mode).toBe('practice');
    expect(first.itemIds.length).toBeGreaterThan(0);
  });

  it('leaves challenges out until the runner exists', async () => {
    const { service } = setup();
    expect((await service.start(45, NOW)).itemIds).not.toContain('ch1');
  });

  it('overview reports the daily session once it exists', async () => {
    const { service } = setup();
    const before = await service.overview(30, NOW);
    expect(before.daily).toBeUndefined();
    expect(before.plan.itemIds.length).toBeGreaterThan(0);
    const daily = await service.start(30, NOW);
    expect((await service.overview(30, NOW)).daily?.id).toBe(daily.id);
  });

  it('overview previews exactly the items start then uses', async () => {
    const { service } = setup();
    const preview = await service.overview(30, NOW);
    const started = await service.start(30, NOW);
    expect(started.itemIds).toEqual(preview.plan.itemIds);
  });

  it('answer grades, stores the attempt and schedules a review', async () => {
    const { repo, service } = setup();
    const s = await service.start(30, NOW);
    const a = await service.answer({
      sessionId: s.id, itemId: 'q0', response: { type: 'mcq', selected: [1] },
      confidence: 'sure', timeSpent: 20, lang: 'vi', now: NOW,
    });
    expect(a).toMatchObject({ score: 0, misconceptionIds: ['m-b'], sessionId: s.id, timeSpent: 20 });
    expect((await service.load(s.id))?.attempts).toHaveLength(1);
    expect(await repo.getReview('q0')).toEqual({ itemId: 'q0', box: 0, dueAt: NOW + DAY_MS });
  });

  it('answer rejects an unknown item', async () => {
    const { service } = setup();
    const s = await service.start(30, NOW);
    await expect(service.answer({
      sessionId: s.id, itemId: 'nope', response: { type: 'mcq', selected: [0] },
      confidence: 'sure', timeSpent: 1, lang: 'vi', now: NOW,
    })).rejects.toThrow('Unknown item');
  });

  it('finish records the finish time and overtime', async () => {
    const { service } = setup();
    const s = await service.start(15, NOW);
    expect(await service.finish(s.id, NOW + 16 * 60_000)).toMatchObject({ finishedAt: NOW + 16 * 60_000, overtimeSec: 60 });
  });

  it('load returns only that session’s attempts, and undefined for unknown ids', async () => {
    const { service } = setup();
    const a = await service.startPractice(['q1'], NOW);
    const b = await service.startPractice(['q2'], NOW);
    await service.answer({
      sessionId: a.id, itemId: 'q1', response: { type: 'mcq', selected: [0] },
      confidence: 'sure', timeSpent: 5, lang: 'en', now: NOW,
    });
    expect((await service.load(b.id))?.attempts).toEqual([]);
    expect(b.itemIds).toEqual(['q2']);
    expect(await service.load('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Viết `src/app/sessionService.ts`**

```ts
import type { Content } from '../content/load';
import { grade, type Response } from '../core/grading';
import { masteryByTopic, type Mastery } from '../core/mastery';
import { diagnose, topGaps, type Gap } from '../core/recommend';
import { nextReview } from '../core/scheduler';
import { buildSession, type Duration, type SessionPlan } from '../core/sessionBuilder';
import type { Attempt, Confidence, Lang, ReviewState } from '../core/types';
import type { Repo, SessionRecord } from '../storage/repo';

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

interface History {
  attempts: Attempt[];
  reviews: ReviewState[];
  mastery: Map<string, Mastery>;
}

export function localDate(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createSessionService(repo: Repo, content: Content) {
  const byId = new Map(content.items.map((i) => [i.id, i]));
  // Challenges need the code runner, which arrives in P3.
  const quizItems = content.items.filter((i) => i.type !== 'challenge');

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
    return buildSession({ duration, date: seed, now, items: quizItems, attempts: h.attempts, reviews: h.reviews, mastery: h.mastery });
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

    /** A short practice run over chosen items, e.g. a gap's plan from the Result screen. */
    async startPractice(itemIds: string[], now: number): Promise<SessionRecord> {
      const session: SessionRecord = {
        id: crypto.randomUUID(), date: localDate(now), mode: 'practice', durationMin: 15,
        itemIds, startedAt: now, overtimeSec: 0,
      };
      await repo.putSession(session);
      return session;
    },

    async load(sessionId: string): Promise<LoadedSession | undefined> {
      const session = await repo.getSession(sessionId);
      if (!session) return undefined;
      const attempts = (await repo.listAttempts()).filter((a) => a.sessionId === sessionId);
      return { session, attempts };
    },

    listAttempts: () => repo.listAttempts(),

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
      const elapsed = Math.round((now - session.startedAt) / 1000);
      const done = { ...session, finishedAt: now, overtimeSec: Math.max(0, elapsed - session.durationMin * 60) };
      await repo.putSession(done);
      return done;
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/app/sessionService.test.ts`. Kỳ vọng: 9 test pass.

---

### Task 4: Report và draft

**Files:** Modify `src/core/schema.ts`. Create `src/app/report.ts`, `src/app/draft.ts`. Test `src/app/report.test.ts`, `src/app/draft.test.ts`

- [ ] **Step 1:** Trong `src/core/schema.ts`, thêm dòng sau ngay dưới `export type Localized = …`:

```ts
export type Option = z.infer<typeof option>;
```

- [ ] **Step 2: Viết test** `src/app/report.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Content } from '../content/load';
import { NOW, attempt, mcq, topic } from '../core/testFixtures';
import { DAY_MS } from '../core/types';
import { buildReport, misconceptionText } from './report';

const content: Content = {
  topics: [topic('render'), topic('render/memo', 'render')],
  items: [mcq('q1'), mcq('q2'), mcq('q3'), mcq('q4')],
  lessons: [],
};

describe('buildReport', () => {
  it('summarises the session against earlier history', () => {
    const attempts = [
      ...['q1', 'q2', 'q3'].map((id) => attempt(id, { sessionId: 'old', score: 0, at: NOW - DAY_MS })),
      attempt('q1', { sessionId: 's', score: 1, timeSpent: 40 }),
      attempt('q2', { sessionId: 's', score: 1, confidence: 'guess', timeSpent: 50 }),
      attempt('q4', { sessionId: 's', score: 0, timeSpent: 30, misconceptionIds: ['m-b'] }),
    ];
    const r = buildReport(content, attempts, 's', NOW);
    expect(r).toMatchObject({ correct: 2, total: 3, timeSpentSec: 120, guessedCorrect: 1 });
    expect(r.score).toBeCloseTo(2 / 3);
    expect(r.wrong.map((w) => w.item.id)).toEqual(['q4']);
    expect(r.deltas).toHaveLength(1);
    expect(r.deltas[0]).toMatchObject({ topicId: 'render/memo', before: 0 });
    expect(r.deltas[0].after).toBeGreaterThan(0);
  });

  it('handles a session with no answers', () => {
    expect(buildReport(content, [], 's', NOW)).toMatchObject({ score: 0, correct: 0, total: 0, deltas: [], wrong: [] });
  });
});

describe('misconceptionText', () => {
  it('finds the text of a misconception id, or undefined', () => {
    expect(misconceptionText(content, 'm-b')).toEqual({ vi: 'b is wrong', en: 'b is wrong' });
    expect(misconceptionText(content, 'nope')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Viết `src/app/report.ts`**

```ts
import type { Content } from '../content/load';
import { masteryByTopic } from '../core/mastery';
import { diagnose, topGaps, type Diagnosis, type Gap } from '../core/recommend';
import { PASS_SCORE } from '../core/scheduler';
import type { Item, Localized, Option } from '../core/schema';
import type { Attempt } from '../core/types';

export interface TopicDelta {
  topicId: string;
  before: number | null;
  after: number | null;
}

export interface SessionReport {
  /** mean score, 0..1 */
  score: number;
  correct: number;
  total: number;
  timeSpentSec: number;
  guessedCorrect: number;
  deltas: TopicDelta[];
  gaps: Gap[];
  diagnoses: Diagnosis[];
  wrong: { item: Item; attempt: Attempt }[];
}

export function buildReport(content: Content, attempts: Attempt[], sessionId: string, now: number): SessionReport {
  const byId = new Map(content.items.map((i) => [i.id, i]));
  const own = attempts.filter((a) => a.sessionId === sessionId);
  const before = masteryByTopic(content.topics, attempts.filter((a) => a.sessionId !== sessionId), byId, now);
  const after = masteryByTopic(content.topics, attempts, byId, now);
  const touched = [...new Set(own.flatMap((a) => byId.get(a.itemId)?.topics.slice(0, 1) ?? []))].sort();
  const correct = own.filter((a) => a.score >= PASS_SCORE);

  return {
    score: own.length > 0 ? own.reduce((s, a) => s + a.score, 0) / own.length : 0,
    correct: correct.length,
    total: own.length,
    timeSpentSec: own.reduce((s, a) => s + a.timeSpent, 0),
    guessedCorrect: correct.filter((a) => a.confidence === 'guess').length,
    deltas: touched.map((topicId) => ({
      topicId,
      before: before.get(topicId)?.value ?? null,
      after: after.get(topicId)?.value ?? null,
    })),
    gaps: topGaps({ topics: content.topics, mastery: after, items: content.items, lessons: content.lessons, attempts }),
    diagnoses: diagnose(content.topics, attempts, byId, now),
    wrong: own
      .filter((a) => a.score < PASS_SCORE)
      .flatMap((attempt) => {
        const item = byId.get(attempt.itemId);
        return item ? [{ item, attempt }] : [];
      }),
  };
}

export function misconceptionText(content: Content, id: string): Localized | undefined {
  for (const item of content.items) {
    const options: Option[] = item.type === 'mcq' ? item.options : item.type === 'spot-bug' ? item.causeOptions : [];
    const hit = options.find((o) => o.misconception?.id === id);
    if (hit?.misconception) return hit.misconception.text;
  }
  return undefined;
}
```

- [ ] **Step 4: Viết test** `src/app/draft.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { challenge, mcq, open, spotBug } from '../core/testFixtures';
import { EMPTY_DRAFT, toResponse, toggleIn } from './draft';

describe('toResponse', () => {
  it('mcq needs a selection', () => {
    expect(toResponse(mcq('q'), EMPTY_DRAFT)).toBeNull();
    expect(toResponse(mcq('q'), { ...EMPTY_DRAFT, selected: [2] })).toEqual({ type: 'mcq', selected: [2] });
  });

  it('spot-bug needs a line and a cause', () => {
    const q = spotBug('s');
    expect(toResponse(q, { ...EMPTY_DRAFT, line: 2 })).toBeNull();
    expect(toResponse(q, { ...EMPTY_DRAFT, line: 2, cause: 1 })).toEqual({ type: 'spot-bug', line: 2, cause: 1 });
  });

  it('open needs the model answer revealed', () => {
    const q = open('o');
    expect(toResponse(q, { ...EMPTY_DRAFT, hits: [0] })).toBeNull();
    expect(toResponse(q, { ...EMPTY_DRAFT, revealed: true })).toEqual({ type: 'open', hitKeyPoints: [] });
  });

  it('challenge has no draft response yet', () => {
    expect(toResponse(challenge('c'), { ...EMPTY_DRAFT, revealed: true, selected: [0] })).toBeNull();
  });
});

describe('toggleIn', () => {
  it('adds in order and removes', () => {
    expect(toggleIn([3], 1)).toEqual([1, 3]);
    expect(toggleIn([1, 3], 3)).toEqual([1]);
  });
});
```

- [ ] **Step 5: Viết `src/app/draft.ts`**

```ts
import type { Response } from '../core/grading';
import type { Item } from '../core/schema';
import type { Confidence } from '../core/types';

/** What the Test screen holds while the user answers one question. */
export interface Draft {
  selected: number[];
  line: number | null;
  cause: number | null;
  hits: number[];
  revealed: boolean;
  confidence: Confidence | null;
}

export const EMPTY_DRAFT: Draft = { selected: [], line: null, cause: null, hits: [], revealed: false, confidence: null };

/** The gradable response, or null while the draft is incomplete. */
export function toResponse(item: Item, d: Draft): Response | null {
  switch (item.type) {
    case 'mcq':
      return d.selected.length > 0 ? { type: 'mcq', selected: d.selected } : null;
    case 'spot-bug':
      return d.line !== null && d.cause !== null ? { type: 'spot-bug', line: d.line, cause: d.cause } : null;
    case 'open':
      return d.revealed ? { type: 'open', hitKeyPoints: d.hits } : null;
    case 'challenge':
      return null;
  }
}

export function toggleIn(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort((a, b) => a - b);
}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/app/report.test.ts src/app/draft.test.ts`. Kỳ vọng: 3 + 5 test pass.

---

### Task 5: Router và format

**Files:** Create `src/app/router.ts`, `src/ui/format.ts`, `src/ui/useNow.ts`. Test `src/app/router.test.ts`, `src/ui/format.test.ts`

- [ ] **Step 1: Viết test** `src/app/router.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { href, parseRoute } from './router';

describe('router', () => {
  it('falls back to today for empty or unknown hashes', () => {
    expect(parseRoute('')).toEqual({ name: 'today' });
    expect(parseRoute('#/')).toEqual({ name: 'today' });
    expect(parseRoute('#/test')).toEqual({ name: 'today' });
    expect(parseRoute('#/nope/x')).toEqual({ name: 'today' });
  });

  it('parses test and result routes', () => {
    expect(parseRoute('#/test/abc')).toEqual({ name: 'test', sessionId: 'abc' });
    expect(parseRoute('#/result/a%20b')).toEqual({ name: 'result', sessionId: 'a b' });
  });

  it('href round-trips through parseRoute', () => {
    for (const r of [{ name: 'today' }, { name: 'test', sessionId: 'x/y' }, { name: 'result', sessionId: 'id-1' }] as const) {
      expect(parseRoute(href(r))).toEqual(r);
    }
  });
});
```

- [ ] **Step 2: Viết `src/app/router.ts`**

```ts
import { useEffect, useState } from 'react';

export type Route = { name: 'today' } | { name: 'test'; sessionId: string } | { name: 'result'; sessionId: string };

export function parseRoute(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/');
  if ((name === 'test' || name === 'result') && id) return { name, sessionId: decodeURIComponent(id) };
  return { name: 'today' };
}

export function href(route: Route): string {
  return route.name === 'today' ? '#/' : `#/${route.name}/${encodeURIComponent(route.sessionId)}`;
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

- [ ] **Step 3: Viết test** `src/ui/format.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { format, formatClock, formatScore, otherLang } from './format';

describe('format', () => {
  it('formatClock pads minutes and seconds', () => {
    expect(formatClock(1122)).toBe('18:42');
    expect(formatClock(5)).toBe('00:05');
  });

  it('formatClock shows overtime with a plus', () => {
    expect(formatClock(-72)).toBe('+01:12');
  });

  it('formatScore uses two decimals', () => {
    expect(formatScore(0.7249)).toBe('0.72');
    expect(formatScore(1)).toBe('1.00');
  });

  it('format fills named slots and keeps unknown ones', () => {
    expect(format('Câu {i} / {n}', { i: 4, n: 12 })).toBe('Câu 4 / 12');
    expect(format('{x} left', {})).toBe('{x} left');
    expect(otherLang('vi')).toBe('en');
  });
});
```

- [ ] **Step 4: Viết `src/ui/format.ts`**

```ts
import type { Lang } from '../core/types';

/** mm:ss; negative seconds are overtime and show as +mm:ss. */
export function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  const abs = Math.abs(s);
  return `${s < 0 ? '+' : ''}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export function formatScore(value: number): string {
  return value.toFixed(2);
}

/** Replaces {name} slots; unknown slots stay as written so a missing value is visible. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (slot, key: string) => (key in vars ? String(vars[key]) : slot));
}

export const otherLang = (lang: Lang): Lang => (lang === 'vi' ? 'en' : 'vi');
```

- [ ] **Step 5: Viết `src/ui/useNow.ts`**

```ts
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

- [ ] **Checkpoint (Warren):** `npx vitest run src/app/router.test.ts src/ui/format.test.ts`. Kỳ vọng: 3 + 4 test pass.

---

### Task 6: Chuỗi song ngữ

**Files:** Create `src/i18n/strings.ts`, `src/i18n/LangProvider.tsx`

- [ ] **Step 1: Viết `src/i18n/strings.ts`**

```ts
import type { Localized } from '../core/schema';

/** Interface copy. Content copy lives in content/; this is only the app's own words. */
export const UI = {
  today: { vi: 'Hôm nay', en: 'Today' },
  loading: { vi: 'Đang tải…', en: 'Loading…' },
  notFound: { vi: 'Không tìm thấy bài này.', en: 'This session was not found.' },
  backToday: { vi: 'Về trang Hôm nay', en: 'Back to Today' },
  storageBanner: {
    vi: 'Trình duyệt đang chặn lưu dữ liệu. Tiến độ lần này sẽ mất khi đóng tab.',
    en: 'This browser blocks storage. Progress from this visit is lost when you close the tab.',
  },
  todayTitle: { vi: 'Hôm nay bạn có bao nhiêu phút?', en: 'How many minutes do you have today?' },
  todaySub: {
    vi: 'Bài được ghép theo điểm yếu và lịch ôn của bạn. Tải lại trang vẫn ra đúng bài hôm nay.',
    en: 'The session is built from your weak spots and review schedule. Reloading gives you the same session.',
  },
  durationGroup: { vi: 'Thời lượng', en: 'Duration' },
  mix15: { vi: 'Nhanh', en: 'Quick' },
  mix30: { vi: 'Tiêu chuẩn', en: 'Standard' },
  mix45: { vi: 'Sâu', en: 'Deep' },
  includes: { vi: 'Bài {d} phút gồm', en: 'The {d}-minute session has' },
  countQuick: { vi: 'câu trắc nghiệm và tìm bug', en: 'multiple-choice and spot-the-bug' },
  countOpen: { vi: 'câu tự luận', en: 'open questions' },
  start: { vi: 'Bắt đầu {d} phút', en: 'Start {d} minutes' },
  startPractice: { vi: 'Luyện thêm {d} phút', en: 'Practise {d} more minutes' },
  resume: { vi: 'Làm tiếp bài hôm nay', en: 'Resume today’s session' },
  viewResult: { vi: 'Xem kết quả hôm nay', en: 'See today’s result' },
  estimate: { vi: 'Ước tính {m} phút · đồng hồ là giới hạn mềm', en: 'About {m} minutes · the timer is a soft limit' },
  emptyBank: { vi: 'Chưa có câu hỏi nào để ghép bài.', en: 'There are no questions to build a session from yet.' },
  weakNow: { vi: 'Đang yếu', en: 'Weak spots' },
  noGaps: {
    vi: 'Chưa đủ dữ liệu. Làm vài bài để app biết bạn yếu ở đâu.',
    en: 'Not enough data yet. Do a few sessions so the app can find your gaps.',
  },
  recentMisconceptions: { vi: 'Hiểu sai gần đây', en: 'Recent misconceptions' },
  seenTimes: { vi: 'Gặp {n} lần trong 30 ngày', en: 'Seen {n} times in 30 days' },
  exit: { vi: '← Thoát', en: '← Exit' },
  questionOf: { vi: 'Câu {i} / {n}', en: 'Question {i} of {n}' },
  dailyTag: { vi: 'Bài Daily · {d} phút', en: 'Daily · {d} minutes' },
  practiceTag: { vi: 'Luyện thêm · {d} phút', en: 'Practice · {d} minutes' },
  timeLeft: { vi: 'Thời gian còn lại', en: 'Time left' },
  selectAll: { vi: 'Chọn tất cả đáp án đúng', en: 'Select all that apply' },
  selectOne: { vi: 'Chọn một đáp án', en: 'Select one answer' },
  answers: { vi: 'Đáp án', en: 'Answers' },
  showOther: { vi: 'Xem bản EN', en: 'Show Vietnamese' },
  showOwn: { vi: 'Về bản VI', en: 'Back to English' },
  pickLine: { vi: 'Bấm vào dòng có lỗi', en: 'Tap the line with the bug' },
  pickCause: { vi: 'Vì sao?', en: 'Why?' },
  yourAnswer: { vi: 'Câu trả lời của bạn (không lưu, chỉ để tập nói)', en: 'Your answer (not saved; practise saying it)' },
  reveal: { vi: 'Xem đáp án mẫu', en: 'Show model answer' },
  modelAnswer: { vi: 'Đáp án mẫu', en: 'Model answer' },
  tickPoints: { vi: 'Tick những ý bạn đã nêu được', en: 'Tick the points you covered' },
  followUps: { vi: 'Câu hỏi nối tiếp', en: 'Follow-up questions' },
  confidence: { vi: 'Bạn chắc đến mức nào?', en: 'How sure are you?' },
  guess: { vi: 'Đoán', en: 'Guess' },
  fairly: { vi: 'Khá chắc', en: 'Fairly sure' },
  sure: { vi: 'Chắc chắn', en: 'Sure' },
  submit: { vi: 'Nộp câu này', en: 'Submit answer' },
  finishSession: { vi: 'Xem kết quả', en: 'See result' },
  kind_core: { vi: 'Cốt lõi', en: 'Core' },
  kind_advanced: { vi: 'Nâng cao', en: 'Advanced' },
  kind_pitfall: { vi: 'Lỗi thường gặp', en: 'Pitfall' },
  'kind_hard-issue': { vi: 'Issue khó', en: 'Hard issue' },
  diff_1: { vi: 'Mid', en: 'Mid' },
  diff_2: { vi: 'Senior', en: 'Senior' },
  diff_3: { vi: 'Staff', en: 'Staff' },
  resultEyebrow: { vi: 'Kết quả', en: 'Result' },
  correctCount: { vi: 'câu đúng', en: 'correct' },
  timeSpent: { vi: 'thời gian', en: 'time' },
  guessed: { vi: 'câu đúng nhưng đoán', en: 'correct but guessed' },
  gapsTitle: { vi: 'Lỗ hổng lớn nhất và việc cần làm', en: 'Biggest gaps and what to do' },
  stepRead: { vi: 'Đọc bài học của chủ đề', en: 'Read the topic’s lesson' },
  stepPractice: { vi: 'Làm {n} câu luyện', en: 'Answer {n} practice questions' },
  stepChallenge: { vi: 'Challenge: {title}', en: 'Challenge: {title}' },
  practiceNow: { vi: 'Luyện ngay · {m} phút', en: 'Practise now · {m} min' },
  'diag_lacks-practice': {
    vi: 'Thiếu thực chiến: cốt lõi {core}, lỗi thường gặp {practice}',
    en: 'Theory without practice: core {core}, pitfalls {practice}',
  },
  'diag_cant-explain': {
    vi: 'Chưa tự giải thích được: trắc nghiệm {recognise}, tự luận {explain}',
    en: 'Recognises but can’t explain: multiple choice {recognise}, open {explain}',
  },
  diag_shaky: { vi: 'Kiến thức chưa chắc: {pct}% câu đúng là đoán', en: 'Shaky: {pct}% of correct answers were guesses' },
  misconceptionTitle: { vi: '✗ Bạn đang hiểu sai', en: '✗ You have a misconception' },
  pickedTimes: { vi: 'Chọn đáp án này ở {n} lần trả lời', en: 'Picked in {n} answers' },
  wrongTitle: { vi: 'Câu sai', en: 'Wrong answers' },
  noneWrong: { vi: 'Không sai câu nào.', en: 'No wrong answers.' },
} satisfies Record<string, Localized>;

export type UiKey = keyof typeof UI;
```

- [ ] **Step 2: Viết `src/i18n/LangProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Localized } from '../core/schema';
import type { Lang } from '../core/types';
import { format } from '../ui/format';
import { UI, type UiKey } from './strings';

interface LangValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: UiKey, vars?: Record<string, string | number>) => string;
  pick: (text: Localized) => string;
}

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ initial, onChange, children }: { initial: Lang; onChange: (lang: Lang) => void; children: ReactNode }) {
  const [lang, setLangState] = useState(initial);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangValue>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        onChange(next);
      },
      t: (key, vars) => format(UI[key][lang], vars),
      pick: (text) => text[lang],
    }),
    [lang, onChange],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const value = useContext(LangContext);
  if (!value) throw new Error('useLang must be used inside LangProvider');
  return value;
}
```

- [ ] **Checkpoint (Warren):** `npx tsc --noEmit`. Kỳ vọng: không lỗi.

---

### Task 7: Theme, font và component dùng chung

**Files:** Create `src/ui/app.css`, `src/ui/components.tsx`, `src/ui/Chrome.tsx`. Modify `index.html`, `src/main.tsx`

- [ ] **Step 1: Sửa `index.html`**: thêm 3 dòng sau vào trong `<head>`, ngay sau thẻ `<meta name="viewport" …>`:

```html
    <meta name="theme-color" content="#0a0d0c" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&display=swap" />
```

- [ ] **Step 2: Sửa `src/main.tsx`**: thêm `import './ui/app.css';` làm dòng import cuối cùng (sau `import { App } from './App';`).

- [ ] **Step 3: Viết `src/ui/app.css`**. Giá trị lấy từ theme dark của Design System (pine green); light theme để P4.

```css
/* Tokens: Design System "RN Interview Prep", dark theme. */
:root {
  color-scheme: dark;
  --surface: #0a0d0c;
  --surface-raised: #121715;
  --line: #222a27;
  --ink: #e6ebe8;
  --ink-muted: #95a39d;
  --accent: #1f7a60;
  --on-accent: #ffffff;
  --accent-ink: #4fbf96;
  --correct: #6cb6ff;
  --wrong: #ff7a6b;
  --mastery-none: #1a211e;
  --mastery-weak: #7a3b33;
  --mastery-learning: #a87a1f;
  --mastery-solid: #6cb6ff;
  --font-display: "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif;
  --font-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 40px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--surface); color: var(--ink); font: 400 15px/23px var(--font-sans); }
a { color: var(--accent-ink); }
:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 2px; }
button { font: inherit; color: inherit; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.5; }
.num, code, pre { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

/* Type */
.display { margin: 0; font: 700 40px/44px var(--font-display); letter-spacing: -0.5px; text-wrap: balance; }
.title { margin: 0; font: 600 22px/30px var(--font-display); text-wrap: balance; }
.numeral { font: 500 32px/36px var(--font-mono); font-variant-numeric: tabular-nums; }
.label { font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: var(--ink-muted); }
.muted { color: var(--ink-muted); font-size: 13px; line-height: 20px; }
.lead { margin: 0; max-width: 560px; color: var(--ink-muted); }
.code-inline { font-size: 13px; padding: 1px 4px; border-radius: var(--radius-sm); background: var(--mastery-none); }

/* Layout */
.stack { display: flex; flex-direction: column; gap: var(--space-3); }
.row { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.between { justify-content: space-between; }
.grow { flex-grow: 1; }
.page { max-width: 1200px; margin: 0 auto; padding: var(--space-5); }

/* Chrome */
.topbar { display: flex; align-items: center; gap: var(--space-5); padding: 20px var(--space-5); border-bottom: 1px solid var(--line); }
.brand { font: 700 20px var(--font-display); color: var(--ink); text-decoration: none; }
.nav { display: flex; gap: var(--space-4); flex-grow: 1; }
.nav a { color: var(--ink-muted); text-decoration: none; }
.nav a[aria-current="page"] { color: var(--accent-ink); font-weight: 600; }
.banner { margin: 0; padding: var(--space-2) var(--space-5); background: var(--mastery-weak); color: var(--ink); }

/* Controls */
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--surface-raised); font-weight: 600; text-decoration: none; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.btn-ghost { background: transparent; }
.btn-small { min-height: 32px; padding: 0 12px; font-size: 12px; }
.chip { display: inline-flex; align-items: center; height: 24px; padding: 0 var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--line); font-size: 12px; }
.pill { min-height: 36px; padding: 0 14px; border-radius: var(--radius-md); border: 1px solid var(--line); background: transparent; }
.pill[aria-checked="true"] { border: 2px solid var(--accent-ink); color: var(--accent-ink); font-weight: 600; }
.card { padding: var(--space-4); border-radius: var(--radius-lg); background: var(--surface-raised); }
.panel { padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--line); }

/* Mastery */
.bar { height: 6px; border-radius: var(--radius-sm); background: var(--mastery-none); overflow: hidden; }
.bar-fill { height: 100%; border-radius: var(--radius-sm); }
.fill-none { background: transparent; }
.fill-weak { background: var(--wrong); }
.fill-learning { background: var(--mastery-learning); }
.fill-solid { background: var(--mastery-solid); }

/* Today */
.today { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); gap: var(--space-5); }
.durations { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
.duration { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--surface-raised); text-align: left; }
.duration[aria-checked="true"] { border: 2px solid var(--accent-ink); }
.duration[aria-checked="true"] .numeral { color: var(--accent-ink); }
.counts { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-3); }
.count { font: 500 22px/28px var(--font-mono); }

/* Test */
.test-header { display: flex; align-items: center; gap: var(--space-4); padding: 20px var(--space-5); border-bottom: 1px solid var(--line); }
.test-header a { color: var(--ink-muted); text-decoration: none; }
.segments { display: grid; gap: var(--space-1); }
.seg { height: 4px; border-radius: var(--radius-sm); background: var(--line); }
.seg-correct { background: var(--correct); }
.seg-wrong { background: var(--wrong); }
.seg-current { background: var(--accent-ink); }
.overtime { color: var(--wrong); }
.question { max-width: 760px; margin: 0 auto; padding: var(--space-5) var(--space-3); display: flex; flex-direction: column; gap: var(--space-4); }
.options { display: flex; flex-direction: column; gap: var(--space-2); }
.option { display: flex; gap: 12px; align-items: flex-start; padding: 14px var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--surface-raised); text-align: left; transition: border-color 120ms; }
.option[aria-pressed="true"] { border: 2px solid var(--accent-ink); }
.option-key { color: var(--ink-muted); }
.option[aria-pressed="true"] .option-key { color: var(--accent-ink); }
.code-block { display: flex; flex-direction: column; padding: var(--space-2) 0; border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--surface-raised); overflow-x: auto; }
.code-line { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: var(--space-3); padding: 0 var(--space-3); border: 0; background: transparent; text-align: left; font: 13px/22px var(--font-mono); white-space: pre; }
.code-line[aria-pressed="true"] { background: var(--mastery-weak); }
.ln { color: var(--ink-muted); text-align: right; }
.answer-box { width: 100%; min-height: 120px; padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--surface-raised); color: var(--ink); font: inherit; resize: vertical; }
.check { display: flex; gap: var(--space-2); align-items: flex-start; }
.confidence { display: flex; align-items: center; gap: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--line); flex-wrap: wrap; }

/* Result */
.summary { display: flex; align-items: flex-end; gap: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.score { font: 500 64px/64px var(--font-mono); font-variant-numeric: tabular-nums; }
.stat { font: 500 22px/28px var(--font-mono); }
.up { color: var(--correct); }
.down { color: var(--wrong); }
.gaps { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4); }
.steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 21px; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4); }
.callout { padding: 20px var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--wrong); }
.callout .label { color: var(--wrong); }
details summary { cursor: pointer; }

@media (max-width: 720px) {
  .today { grid-template-columns: minmax(0, 1fr); }
  .page { padding: var(--space-3); }
  .topbar, .test-header { padding: var(--space-3); gap: var(--space-3); }
}

@media (prefers-reduced-motion: reduce) {
  .option { transition: none; }
}
```

- [ ] **Step 4: Viết `src/ui/components.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Level } from '../core/mastery';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`btn btn-${variant} ${className}`.trim()} {...rest} />;
}

export function Chip({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <span className={mono ? 'chip num' : 'chip'}>{children}</span>;
}

/** Renders `backtick` spans in content copy as inline code. */
export function Rich({ text }: { text: string }) {
  return <>{text.split(/`([^`]+)`/).map((part, i) => (i % 2 === 1 ? <code key={i} className="code-inline">{part}</code> : part))}</>;
}

const FILL: Record<Level, string> = { insufficient: 'fill-none', weak: 'fill-weak', learning: 'fill-learning', solid: 'fill-solid' };

export function MasteryBar({ value, level }: { value: number | null; level: Level }) {
  return (
    <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value ?? undefined}>
      <div className={`bar-fill ${FILL[level]}`} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
    </div>
  );
}

export type SegmentState = 'correct' | 'wrong' | 'current' | 'todo';

export function Segments({ states }: { states: SegmentState[] }) {
  return (
    <div className="segments" style={{ gridTemplateColumns: `repeat(${states.length}, minmax(0, 1fr))` }}>
      {states.map((s, i) => (
        <span key={i} className={`seg seg-${s}`} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Viết `src/ui/Chrome.tsx`**

```tsx
import { href } from '../app/router';
import { useLang } from '../i18n/LangProvider';
import { Button } from './components';
import { otherLang } from './format';

export function TopBar() {
  const { lang, setLang, t } = useLang();
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: 'today' })}>RN Interview Prep</a>
      <nav className="nav">
        <a href={href({ name: 'today' })} aria-current="page">{t('today')}</a>
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

- [ ] **Checkpoint (Warren):** `npx tsc --noEmit`. Kỳ vọng: không lỗi.

---

### Task 8: Màn Hôm nay

**Files:** Create `src/screens/TodayScreen.tsx`

- [ ] **Step 1: Viết `src/screens/TodayScreen.tsx`** (mockup màn 1)

```tsx
import { useEffect, useState } from 'react';
import { misconceptionText } from '../app/report';
import { href, navigate } from '../app/router';
import type { Overview, SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import { levelOf } from '../core/mastery';
import type { Duration } from '../core/sessionBuilder';
import { useLang } from '../i18n/LangProvider';
import { Button, MasteryBar, Rich } from '../ui/components';
import { formatScore } from '../ui/format';

const DURATIONS: Duration[] = [15, 30, 45];
const MIX_KEY = { 15: 'mix15', 30: 'mix30', 45: 'mix45' } as const;

export function TodayScreen({ service, content }: { service: SessionService; content: Content }) {
  const { lang, t, pick } = useLang();
  const [duration, setDuration] = useState<Duration>(30);
  const [overview, setOverview] = useState<Overview>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void service.overview(duration, Date.now()).then((o) => {
      if (live) setOverview(o);
    });
    return () => {
      live = false;
    };
  }, [service, duration]);

  const byId = new Map(content.items.map((i) => [i.id, i]));
  const planItems = (overview?.plan.itemIds ?? []).flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const quick = planItems.filter((i) => i.type === 'mcq' || i.type === 'spot-bug').length;
  const opens = planItems.filter((i) => i.type === 'open').length;
  const minutes = Math.round((overview?.plan.estSeconds ?? 0) / 60);
  const daily = overview?.daily;
  const topicTitle = (id: string) => {
    const topic = content.topics.find((x) => x.id === id);
    return topic ? pick(topic.title) : id;
  };

  async function start() {
    setBusy(true);
    const session = await service.start(duration, Date.now());
    navigate({ name: 'test', sessionId: session.id });
  }

  return (
    <main className="page today">
      <section className="stack" style={{ gap: 'var(--space-5)' }}>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <span className="label">
            {new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'numeric' })}
          </span>
          <h1 className="display">{t('todayTitle')}</h1>
          <p className="lead">{t('todaySub')}</p>
        </div>

        <div role="radiogroup" aria-label={t('durationGroup')} className="durations">
          {DURATIONS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={d === duration} className="duration" onClick={() => setDuration(d)}>
              <span className="numeral">{d}'</span>
              <span className="muted">{t(MIX_KEY[d])}</span>
            </button>
          ))}
        </div>

        <div className="panel stack">
          <span className="label">{t('includes', { d: duration })}</span>
          <div className="counts">
            <div className="stack" style={{ gap: 2 }}>
              <span className="count">{quick}</span>
              <span className="muted">{t('countQuick')}</span>
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <span className="count">{opens}</span>
              <span className="muted">{t('countOpen')}</span>
            </div>
          </div>
        </div>

        {overview && planItems.length === 0 ? <p className="muted">{t('emptyBank')}</p> : null}

        <div className="row">
          {daily && !daily.finishedAt ? (
            <a className="btn btn-primary" href={href({ name: 'test', sessionId: daily.id })}>{t('resume')}</a>
          ) : (
            <Button variant="primary" disabled={busy || planItems.length === 0} onClick={() => void start()}>
              {t(daily ? 'startPractice' : 'start', { d: duration })}
            </Button>
          )}
          {daily?.finishedAt ? <a href={href({ name: 'result', sessionId: daily.id })}>{t('viewResult')}</a> : null}
          <span className="muted">{t('estimate', { m: minutes })}</span>
        </div>
      </section>

      <aside className="stack" style={{ gap: 'var(--space-4)' }}>
        <div className="card stack">
          <span className="label">{t('weakNow')}</span>
          {overview && overview.gaps.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('noGaps')}</p> : null}
          {overview?.gaps.map((g) => (
            <div key={g.topicId} className="stack" style={{ gap: 6 }}>
              <div className="row between">
                <span>{topicTitle(g.topicId)}</span>
                <span className="num">{formatScore(g.mastery)}</span>
              </div>
              {/* a gap always has enough attempts, so only the value decides its level */}
              <MasteryBar value={g.mastery} level={levelOf(g.mastery, Number.MAX_SAFE_INTEGER)} />
            </div>
          ))}
        </div>

        {overview && overview.misconceptions.length > 0 ? (
          <div className="panel stack">
            <span className="label">{t('recentMisconceptions')}</span>
            {overview.misconceptions.slice(0, 3).map((m) => {
              const text = misconceptionText(content, m.id);
              return (
                <div key={m.id} className="stack" style={{ gap: 2 }}>
                  <span><Rich text={text ? pick(text) : m.id} /></span>
                  <span className="num muted">{t('seenTimes', { n: m.occurrences })}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </aside>
    </main>
  );
}
```

---

### Task 9: Màn Làm bài

**Files:** Create `src/screens/questions/McqView.tsx`, `src/screens/questions/SpotBugView.tsx`, `src/screens/questions/OpenView.tsx`, `src/screens/TestScreen.tsx`

- [ ] **Step 1: Viết `src/screens/questions/McqView.tsx`**

```tsx
import { toggleIn } from '../../app/draft';
import type { Localized, Mcq } from '../../core/schema';
import { useLang } from '../../i18n/LangProvider';
import { Rich } from '../../ui/components';

export function McqView({ item, selected, onChange, text }: {
  item: Mcq;
  selected: number[];
  onChange: (selected: number[]) => void;
  text: (l: Localized) => string;
}) {
  const { t } = useLang();
  return (
    <div role="group" aria-label={t('answers')} className="options">
      {item.options.map((o, i) => (
        <button key={i} type="button" className="option" aria-pressed={selected.includes(i)} onClick={() => onChange(item.multi ? toggleIn(selected, i) : [i])}>
          <span className="num option-key">{String.fromCharCode(65 + i)}</span>
          <span><Rich text={text(o.text)} /></span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Viết `src/screens/questions/SpotBugView.tsx`**

```tsx
import type { Localized, SpotBug } from '../../core/schema';
import { useLang } from '../../i18n/LangProvider';
import { Rich } from '../../ui/components';

export function SpotBugView({ item, line, cause, onChange, text }: {
  item: SpotBug;
  line: number | null;
  cause: number | null;
  onChange: (value: { line: number | null; cause: number | null }) => void;
  text: (l: Localized) => string;
}) {
  const { t } = useLang();
  return (
    <div className="stack">
      <span className="muted">{t('pickLine')}</span>
      <div role="group" aria-label={t('pickLine')} className="code-block">
        {item.code.split('\n').map((src, i) => (
          <button key={i} type="button" className="code-line" aria-pressed={line === i + 1} onClick={() => onChange({ line: i + 1, cause })}>
            <span className="ln">{i + 1}</span>
            <span>{src || ' '}</span>
          </button>
        ))}
      </div>
      <span className="muted">{t('pickCause')}</span>
      <div role="group" aria-label={t('pickCause')} className="options">
        {item.causeOptions.map((o, i) => (
          <button key={i} type="button" className="option" aria-pressed={cause === i} onClick={() => onChange({ line, cause: i })}>
            <span className="num option-key">{String.fromCharCode(65 + i)}</span>
            <span><Rich text={text(o.text)} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Viết `src/screens/questions/OpenView.tsx`**

```tsx
import { useState } from 'react';
import { toggleIn } from '../../app/draft';
import type { Localized, Open } from '../../core/schema';
import { useLang } from '../../i18n/LangProvider';
import { Button, Rich } from '../../ui/components';

export function OpenView({ item, hits, revealed, onReveal, onHits, text }: {
  item: Open;
  hits: number[];
  revealed: boolean;
  onReveal: () => void;
  onHits: (hits: number[]) => void;
  text: (l: Localized) => string;
}) {
  const { t } = useLang();
  const [answer, setAnswer] = useState('');
  return (
    <div className="stack">
      <label className="stack" style={{ gap: 'var(--space-2)' }} htmlFor={`answer-${item.id}`}>
        <span className="muted">{t('yourAnswer')}</span>
        <textarea id={`answer-${item.id}`} className="answer-box" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </label>
      {!revealed ? (
        <Button onClick={onReveal}>{t('reveal')}</Button>
      ) : (
        <div className="card stack">
          <span className="label">{t('modelAnswer')}</span>
          <p style={{ margin: 0 }}><Rich text={text(item.modelAnswer)} /></p>
          <span className="label">{t('tickPoints')}</span>
          {item.keyPoints.map((k, i) => (
            <label key={i} className="check">
              <input type="checkbox" checked={hits.includes(i)} onChange={() => onHits(toggleIn(hits, i))} />
              <span><Rich text={text(k)} /></span>
            </label>
          ))}
          {item.followUps.length > 0 ? (
            <>
              <span className="label">{t('followUps')}</span>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {item.followUps.map((f, i) => (
                  <li key={i}><Rich text={text(f)} /></li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Viết `src/screens/TestScreen.tsx`** (mockup màn 2)

```tsx
import { useEffect, useMemo, useState } from 'react';
import { EMPTY_DRAFT, toResponse, type Draft } from '../app/draft';
import { href, navigate } from '../app/router';
import type { LoadedSession, SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import { PASS_SCORE } from '../core/scheduler';
import type { Item, Localized } from '../core/schema';
import type { Confidence } from '../core/types';
import { useLang } from '../i18n/LangProvider';
import type { UiKey } from '../i18n/strings';
import { NotFound } from '../ui/Chrome';
import { Button, Chip, Rich, Segments, type SegmentState } from '../ui/components';
import { formatClock, otherLang } from '../ui/format';
import { useNow } from '../ui/useNow';
import { McqView } from './questions/McqView';
import { OpenView } from './questions/OpenView';
import { SpotBugView } from './questions/SpotBugView';

const CONFIDENCE: Confidence[] = ['guess', 'fairly', 'sure'];

export function TestScreen({ service, content, sessionId }: { service: SessionService; content: Content; sessionId: string }) {
  const { lang, t } = useLang();
  const now = useNow();
  const byId = useMemo(() => new Map(content.items.map((i) => [i.id, i])), [content]);
  const [data, setData] = useState<LoadedSession | null>();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [alt, setAlt] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void service.load(sessionId).then((d) => {
      if (live) setData(d ?? null);
    });
    return () => {
      live = false;
    };
  }, [service, sessionId]);

  if (data === undefined) return <p className="page muted">{t('loading')}</p>;
  if (data === null) return <NotFound />;

  const { session, attempts } = data;
  const answered = new Map(attempts.map((a) => [a.itemId, a]));
  const index = session.itemIds.findIndex((id) => !answered.has(id));
  const item = index === -1 ? undefined : byId.get(session.itemIds[index]);
  const textLang = alt ? otherLang(lang) : lang;
  const text = (l: Localized) => l[textLang];
  const remaining = session.durationMin * 60 - (now - session.startedAt) / 1000;
  const states: SegmentState[] = session.itemIds.map((id, i) => {
    const a = answered.get(id);
    if (a) return a.score >= PASS_SCORE ? 'correct' : 'wrong';
    return i === index ? 'current' : 'todo';
  });

  async function finish() {
    setBusy(true);
    await service.finish(sessionId, Date.now());
    navigate({ name: 'result', sessionId });
  }

  async function submit(target: Item) {
    const response = toResponse(target, draft);
    if (!response || !draft.confidence) return;
    setBusy(true);
    const attempt = await service.answer({
      sessionId, itemId: target.id, response, confidence: draft.confidence,
      timeSpent: Math.round((Date.now() - shownAt) / 1000), lang: textLang, now: Date.now(),
    });
    if (session.itemIds.every((id) => id === target.id || answered.has(id))) {
      await finish();
      return;
    }
    setData({ session, attempts: [...attempts, attempt] });
    setDraft(EMPTY_DRAFT);
    setAlt(false);
    setShownAt(Date.now());
    setBusy(false);
  }

  const position = index === -1 ? session.itemIds.length : index + 1;
  const header = (
    <header className="test-header">
      <a href={href({ name: 'today' })}>{t('exit')}</a>
      <div className="stack grow" style={{ gap: 'var(--space-2)' }}>
        <div className="row between muted">
          <span className="num">{t('questionOf', { i: position, n: session.itemIds.length })}</span>
          <span>{t(session.mode === 'daily' ? 'dailyTag' : 'practiceTag', { d: session.durationMin })}</span>
        </div>
        <Segments states={states} />
      </div>
      <span className={remaining < 0 ? 'numeral overtime' : 'numeral'} aria-label={t('timeLeft')}>{formatClock(remaining)}</span>
    </header>
  );

  if (!item) {
    return (
      <>
        {header}
        <main className="question">
          <Button variant="primary" disabled={busy} onClick={() => void finish()}>{t('finishSession')}</Button>
        </main>
      </>
    );
  }

  const ready = toResponse(item, draft) !== null && draft.confidence !== null;

  return (
    <>
      {header}
      <main className="question">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Chip><span className="label">{t(`kind_${item.kind}` as UiKey)}</span></Chip>
          <Chip><span className="label">{t(`diff_${item.difficulty}` as UiKey)}</span></Chip>
          <Chip mono>{item.topics[0]}</Chip>
          <span className="grow" />
          <Button className="btn-small" onClick={() => setAlt(!alt)}>{t(alt ? 'showOwn' : 'showOther')}</Button>
        </div>

        {item.type !== 'challenge' ? <h2 className="title"><Rich text={text(item.prompt)} /></h2> : null}

        {item.type === 'mcq' ? (
          <>
            <span className="muted">{t(item.multi ? 'selectAll' : 'selectOne')}</span>
            <McqView key={item.id} item={item} selected={draft.selected} onChange={(selected) => setDraft({ ...draft, selected })} text={text} />
          </>
        ) : null}
        {item.type === 'spot-bug' ? (
          <SpotBugView key={item.id} item={item} line={draft.line} cause={draft.cause} onChange={(v) => setDraft({ ...draft, ...v })} text={text} />
        ) : null}
        {item.type === 'open' ? (
          <OpenView
            key={item.id}
            item={item}
            hits={draft.hits}
            revealed={draft.revealed}
            onReveal={() => setDraft({ ...draft, revealed: true })}
            onHits={(hits) => setDraft({ ...draft, hits })}
            text={text}
          />
        ) : null}

        <div className="confidence">
          <span className="muted" style={{ fontSize: 14 }}>{t('confidence')}</span>
          <div role="radiogroup" aria-label={t('confidence')} className="row grow" style={{ gap: 'var(--space-2)' }}>
            {CONFIDENCE.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={draft.confidence === c} className="pill" onClick={() => setDraft({ ...draft, confidence: c })}>
                {t(c)}
              </button>
            ))}
          </div>
          <Button variant="primary" disabled={!ready || busy} onClick={() => void submit(item)}>{t('submit')}</Button>
        </div>
      </main>
    </>
  );
}
```

---

### Task 10: Màn Kết quả

**Files:** Create `src/screens/ResultScreen.tsx`

- [ ] **Step 1: Viết `src/screens/ResultScreen.tsx`** (mockup màn 4)

```tsx
import { useEffect, useState } from 'react';
import { buildReport, misconceptionText, type SessionReport } from '../app/report';
import { href, navigate } from '../app/router';
import type { SessionService } from '../app/sessionService';
import type { Content } from '../content/load';
import type { Diagnosis, PlanStep } from '../core/recommend';
import { useLang } from '../i18n/LangProvider';
import { NotFound } from '../ui/Chrome';
import { Button, Rich } from '../ui/components';
import { formatClock, formatScore } from '../ui/format';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stack" style={{ gap: 0 }}>
      <span className="stat">{value}</span>
      <span className="muted">{label}</span>
    </div>
  );
}

function Delta({ before, after }: { before: number | null; after: number | null }) {
  if (after === null) return null;
  const up = before === null || after >= before;
  return (
    <span className={up ? 'num up' : 'num down'}>
      {up ? '▲' : '▼'} {before === null ? '–' : formatScore(before)} → {formatScore(after)}
    </span>
  );
}

export function ResultScreen({ service, content, sessionId }: { service: SessionService; content: Content; sessionId: string }) {
  const { t, pick } = useLang();
  const [report, setReport] = useState<SessionReport | null>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([service.load(sessionId), service.listAttempts()]).then(([loaded, all]) => {
      if (live) setReport(loaded ? buildReport(content, all, sessionId, Date.now()) : null);
    });
    return () => {
      live = false;
    };
  }, [service, content, sessionId]);

  if (report === undefined) return <p className="page muted">{t('loading')}</p>;
  if (report === null) return <NotFound />;

  const byId = new Map(content.items.map((i) => [i.id, i]));
  const topicTitle = (id: string) => {
    const topic = content.topics.find((x) => x.id === id);
    return topic ? pick(topic.title) : id;
  };
  const describe = (d: Diagnosis | undefined): string | null => {
    if (!d) return null;
    switch (d.code) {
      case 'lacks-practice':
        return t('diag_lacks-practice', { core: formatScore(d.core), practice: formatScore(d.practice) });
      case 'cant-explain':
        return t('diag_cant-explain', { recognise: formatScore(d.recognise), explain: formatScore(d.explain) });
      case 'shaky':
        return t('diag_shaky', { pct: Math.round(d.guessRatio * 100) });
      default:
        return null;
    }
  };
  const stepText = (s: PlanStep): string => {
    if (s.kind === 'read') return t('stepRead');
    if (s.kind === 'practice') return t('stepPractice', { n: s.itemIds.length });
    const ch = byId.get(s.itemId);
    return t('stepChallenge', { title: ch?.type === 'challenge' ? pick(ch.title) : s.itemId });
  };
  const misconceptions = report.diagnoses.flatMap((d) => (d.code === 'misconception' ? [d] : []));

  async function practise(itemIds: string[]) {
    setBusy(true);
    const session = await service.startPractice(itemIds, Date.now());
    navigate({ name: 'test', sessionId: session.id });
  }

  return (
    <main className="page stack" style={{ gap: 'var(--space-5)' }}>
      <section className="summary">
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          <span className="label">{t('resultEyebrow')}</span>
          <span className="score">{formatScore(report.score)}</span>
        </div>
        <div className="row grow" style={{ gap: 'var(--space-5)' }}>
          <Stat value={`${report.correct} / ${report.total}`} label={t('correctCount')} />
          <Stat value={formatClock(report.timeSpentSec)} label={t('timeSpent')} />
          <Stat value={String(report.guessedCorrect)} label={t('guessed')} />
        </div>
        <div className="stack" style={{ gap: 6 }}>
          {report.deltas.map((d) => (
            <span key={d.topicId}>
              {topicTitle(d.topicId)} <Delta before={d.before} after={d.after} />
            </span>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="title">{t('gapsTitle')}</h2>
        {report.gaps.length === 0 ? <p className="muted">{t('noGaps')}</p> : null}
        <div className="gaps">
          {report.gaps.map((g, index) => {
            const diagnosis = describe(report.diagnoses.find((d) => 'topicId' in d && d.topicId === g.topicId));
            const practice = g.plan.find((s): s is Extract<PlanStep, { kind: 'practice' }> => s.kind === 'practice');
            return (
              <article key={g.topicId} className={index === 0 ? 'card stack' : 'panel stack'}>
                <div className="row between">
                  <span style={{ fontWeight: 600 }}>{topicTitle(g.topicId)}</span>
                  <span className="num">{formatScore(g.mastery)}</span>
                </div>
                {diagnosis ? <span className="muted">{diagnosis}</span> : null}
                <ol className="steps">
                  {g.plan.map((s) => (
                    <li key={s.kind}>
                      {stepText(s)} <span className="num muted">{s.minutes}'</span>
                    </li>
                  ))}
                </ol>
                {practice ? (
                  <Button variant={index === 0 ? 'primary' : 'secondary'} disabled={busy} onClick={() => void practise(practice.itemIds)}>
                    {t('practiceNow', { m: practice.minutes })}
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="two">
        {misconceptions.length > 0 ? (
          <div className="callout stack" style={{ gap: 'var(--space-2)' }}>
            <span className="label">{t('misconceptionTitle')}</span>
            {misconceptions.slice(0, 3).map((m) => {
              const text = misconceptionText(content, m.misconceptionId);
              return (
                <div key={m.misconceptionId} className="stack" style={{ gap: 2 }}>
                  <span><Rich text={text ? pick(text) : m.misconceptionId} /></span>
                  <span className="num muted">{t('pickedTimes', { n: m.occurrences })}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="panel stack" style={{ gap: 'var(--space-2)' }}>
          <span className="label">{t('wrongTitle')}</span>
          {report.wrong.length === 0 ? <span className="muted">{t('noneWrong')}</span> : null}
          {report.wrong.map(({ item }) => (
            <details key={item.id}>
              <summary>
                <span className="down">✗</span> {item.type === 'challenge' ? pick(item.title) : <Rich text={pick(item.prompt)} />}
              </summary>
              {'explanation' in item ? <p className="muted"><Rich text={pick(item.explanation)} /></p> : null}
              {item.type === 'open' ? <p className="muted"><Rich text={pick(item.modelAnswer)} /></p> : null}
            </details>
          ))}
        </div>
      </section>

      <a href={href({ name: 'today' })}>{t('backToday')}</a>
    </main>
  );
}
```

---

### Task 11: Nối App

**Files:** Modify `src/App.tsx` (thay toàn bộ)

- [ ] **Step 1: Thay `src/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useRoute } from './app/router';
import { createSessionService, type SessionService } from './app/sessionService';
import { content } from './content';
import type { Lang } from './core/types';
import { LangProvider } from './i18n/LangProvider';
import { ResultScreen } from './screens/ResultScreen';
import { TestScreen } from './screens/TestScreen';
import { TodayScreen } from './screens/TodayScreen';
import { openRepo } from './storage/openRepo';
import type { Repo } from './storage/repo';
import { StorageBanner, TopBar } from './ui/Chrome';

interface Booted {
  repo: Repo;
  persistent: boolean;
  lang: Lang;
  service: SessionService;
}

export function App() {
  const route = useRoute();
  const [boot, setBoot] = useState<Booted>();

  useEffect(() => {
    void openRepo().then(async ({ repo, persistent }) => {
      const lang = (await repo.getSetting<Lang>('lang')) ?? 'vi';
      setBoot({ repo, persistent, lang, service: createSessionService(repo, content) });
    });
  }, []);

  const saveLang = useCallback(
    (lang: Lang) => {
      void boot?.repo.setSetting('lang', lang);
    },
    [boot],
  );

  if (!boot) return null;

  return (
    <LangProvider initial={boot.lang} onChange={saveLang}>
      {route.name !== 'test' ? <TopBar /> : null}
      {!boot.persistent ? <StorageBanner /> : null}
      {route.name === 'today' ? <TodayScreen service={boot.service} content={content} /> : null}
      {route.name === 'test' ? <TestScreen key={route.sessionId} service={boot.service} content={content} sessionId={route.sessionId} /> : null}
      {route.name === 'result' ? <ResultScreen key={route.sessionId} service={boot.service} content={content} sessionId={route.sessionId} /> : null}
    </LangProvider>
  );
}
```

- [ ] **Checkpoint (Warren):** `npm run dev`, mở trang, làm hết một bài 30 phút (4 câu mẫu), xem màn Kết quả, rồi tải lại trang: vẫn thấy "Xem kết quả hôm nay".

---

### Task 12: Kiểm chứng toàn phase

- [ ] **Step 1: Báo Warren** là chưa kiểm chứng, và đưa lệnh:

```bash
cd ~/Downloads/rn-interview-prep && npm run check
```

Kỳ vọng: `tsc` không lỗi, Vitest báo **101 test pass trên 16 file**. Trong đó 67 test là của P1 và 34 test mới (sau review thêm 1 test cho `finish`):

| File test | Test mới |
|---|---|
| recommend | +1 |
| storage/repo | 8 |
| sessionService | 10 |
| report | 3 |
| draft | 5 |
| router | 3 |
| format | 4 |

- [ ] **Step 2:** Controller commit và push sau mỗi nhóm task, mỗi commit 1 dòng `P2: …`.
