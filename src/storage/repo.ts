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
  getDraft(challengeId: string): Promise<string | undefined>;
  putDraft(challengeId: string, code: string): Promise<void>;
  getSetting<T>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: unknown): Promise<void>;
}

export function createMemoryRepo(): Repo {
  const sessions = new Map<string, SessionRecord>();
  const attempts: Attempt[] = [];
  const reviews = new Map<string, ReviewState>();
  const settings = new Map<string, unknown>();
  const drafts = new Map<string, string>();
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
    async getDraft(challengeId) {
      return drafts.get(challengeId);
    },
    async putDraft(challengeId, code) {
      drafts.set(challengeId, code);
    },
    async getSetting<T>(key: string) {
      return settings.get(key) as T | undefined;
    },
    async setSetting(key, value) {
      settings.set(key, value);
    },
  };
}
