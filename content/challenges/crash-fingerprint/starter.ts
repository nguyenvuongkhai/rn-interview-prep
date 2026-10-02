export interface CrashReport {
  id: string;
  timestamp: number;
  frames: string[];
}

export interface GroupOptions {
  ignorePrefixes: string[];
  topN: number;
}

export interface CrashGroup {
  fingerprint: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  reportIds: string[];
}

export function normaliseFrame(frame: string): string {
  // TODO: strip `at `, addresses, query strings and line/column numbers
  throw new Error('Not implemented');
}

export function groupCrashes(reports: CrashReport[], options: GroupOptions): CrashGroup[] {
  // TODO: fingerprint each report from its top app frames, then group and sort
  throw new Error('Not implemented');
}
