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
