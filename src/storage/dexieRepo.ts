import Dexie, { type Table } from 'dexie';
import type { Attempt, ReviewState } from '../core/types';
import type { Repo, SessionRecord } from './repo';

export type AppDb = Dexie & {
  sessions: Table<SessionRecord, string>;
  attempts: Table<Attempt, string>;
  reviews: Table<ReviewState, string>;
  settings: Table<{ key: string; value: unknown }, string>;
  drafts: Table<{ challengeId: string; code: string; updatedAt: number }, string>;
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
  };
}
