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
});
