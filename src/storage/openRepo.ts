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
