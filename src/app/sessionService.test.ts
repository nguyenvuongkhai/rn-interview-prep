import { describe, expect, it } from 'vitest';
import type { Content } from '../content/load';
import { NOW, challenge, mcq, open, topic } from '../core/testFixtures';
import { DAY_MS } from '../core/types';
import { createMemoryRepo } from '../storage/repo';
import { parseBackup } from './backup';
import { createSessionService, localDate } from './sessionService';

const content: Content = {
  topics: [topic('render'), topic('render/memo', 'render')],
  items: [...Array.from({ length: 12 }, (_, i) => mcq(`q${i}`)), open('o1'), challenge('ch1')],
  lessons: [],
  challenges: {},
  roadmap: { areas: [], items: [] },
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

  it('includes challenges in the plan', async () => {
    const { service } = setup();
    expect((await service.start(45, NOW)).itemIds).toContain('ch1');
  });

  it('keeps challenge code drafts', async () => {
    const { service } = setup();
    await service.saveDraft('ch1', 'export {}');
    expect(await service.loadDraft('ch1')).toBe('export {}');
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
    expect(a).toMatchObject({ score: 0, misconceptionIds: ['m-b'], sessionId: s.id, timeSpent: 20, picked: { selected: [1] } });
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

  it('finish keeps the first finish time when called again', async () => {
    const { service } = setup();
    const s = await service.start(15, NOW);
    await service.finish(s.id, NOW + 16 * 60_000);
    expect(await service.finish(s.id, NOW + 30 * 60_000)).toMatchObject({ finishedAt: NOW + 16 * 60_000, overtimeSec: 60 });
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
});
