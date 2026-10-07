import { z } from 'zod';
import type { Snapshot } from '../storage/repo';
import { localDate } from './dates';
import { MAP_SETTING } from './map';
import { ROADMAP_SETTING, isStringArray } from './roadmap';

export const BACKUP_APP = 'rn-interview-prep';
export const BACKUP_VERSION = 1;

const testResult = z.object({
  name: z.string(), category: z.string(), pass: z.boolean(), error: z.string().optional(), hidden: z.boolean(),
});
const attempt = z.object({
  id: z.string(), itemId: z.string(), sessionId: z.string(),
  score: z.number().min(0).max(1), timeSpent: z.number().min(0),
  confidence: z.enum(['guess', 'fairly', 'sure']), usedHints: z.number().int().min(0), lang: z.enum(['vi', 'en']),
  at: z.number(), misconceptionIds: z.array(z.string()), testResults: z.array(testResult).optional(),
  picked: z
    .object({
      selected: z.array(z.number().int()).optional(),
      line: z.number().int().optional(),
      cause: z.number().int().optional(),
      hitKeyPoints: z.array(z.number().int()).optional(),
    })
    .optional(),
});
const session = z.object({
  id: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mode: z.enum(['daily', 'practice']),
  durationMin: z.union([z.literal(15), z.literal(30), z.literal(45)]), itemIds: z.array(z.string()),
  startedAt: z.number(), finishedAt: z.number().optional(), overtimeSec: z.number().min(0),
});
const review = z.object({ itemId: z.string(), box: z.number().int().min(0), dueAt: z.number() });
const draft = z.object({ challengeId: z.string(), code: z.string(), updatedAt: z.number() });
// Settings the app reads at boot must hold values it understands, or a bad backup would break every load.
const KNOWN_SETTINGS: Record<string, (value: unknown) => boolean> = {
  lang: (v) => v === 'vi' || v === 'en',
  theme: (v) => v === 'dark' || v === 'light' || v === 'system',
  [ROADMAP_SETTING]: isStringArray,
  [MAP_SETTING]: isStringArray,
};
const setting = z
  .object({ key: z.string(), value: z.unknown() })
  .refine((s) => !Object.hasOwn(KNOWN_SETTINGS, s.key) || KNOWN_SETTINGS[s.key](s.value), {
    message: 'unsupported value for this setting',
    path: ['value'],
  });

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number(),
  sessions: z.array(session),
  attempts: z.array(attempt),
  reviews: z.array(review),
  drafts: z.array(draft),
  settings: z.array(setting),
});

export type Backup = z.infer<typeof backupSchema>;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export function toBackup(snapshot: Snapshot, now: number): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now, ...snapshot };
}

/** Validates a backup file's text; throws BackupError naming the first bad field. */
export function parseBackup(text: string): Snapshot {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('The file is not valid JSON.');
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BackupError(`Not a backup from this app: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  const b = result.data;
  return {
    sessions: b.sessions,
    attempts: b.attempts,
    reviews: b.reviews,
    drafts: b.drafts,
    settings: b.settings.map((s) => ({ key: s.key, value: s.value })),
  };
}

export function backupFileName(now: number): string {
  return `${BACKUP_APP}-${localDate(now)}.json`;
}
