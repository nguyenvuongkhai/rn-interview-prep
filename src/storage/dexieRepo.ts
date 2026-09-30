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
