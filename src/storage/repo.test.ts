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

  it('keeps one code draft per challenge', async () => {
    const repo = make();
    expect(await repo.getDraft('deb')).toBeUndefined();
    await repo.putDraft('deb', 'a');
    await repo.putDraft('deb', 'b');
    expect(await repo.getDraft('deb')).toBe('b');
  });
});
