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
