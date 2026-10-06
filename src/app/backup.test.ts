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

  it('rejects a setting value the app cannot use', () => {
    const bad = toBackup({ ...snapshot, settings: [{ key: 'lang', value: 'fr' }] }, NOW);
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('settings.0.value');
  });

  it('keeps roadmap ticks and rejects a value that is not a list of ids', () => {
    const withRoadmap: Snapshot = { ...snapshot, settings: [...snapshot.settings, { key: 'roadmap', value: ['rn-middle-01'] }] };
    expect(parseBackup(JSON.stringify(toBackup(withRoadmap, NOW)))).toEqual(withRoadmap);
    const bad = toBackup({ ...snapshot, settings: [{ key: 'roadmap', value: 'rn-middle-01' }] }, NOW);
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('settings.0.value');
  });

  it('names the file after the local date', () => {
    expect(backupFileName(new Date(2026, 9, 1, 9).getTime())).toBe('rn-interview-prep-2026-10-01.json');
  });
});
