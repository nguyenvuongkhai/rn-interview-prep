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
  return frame
    .trim()
    .replace(/^at\s+/, '')
    .replace(/0x[0-9a-f]+/gi, '')
    .replace(/\?[^:)]*/g, '')
    .replace(/(?::\d+)+(?=\)|$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLibraryFrame(frame: string, prefixes: string[]): boolean {
  const open = frame.indexOf('(');
  const symbol = (open === -1 ? frame : frame.slice(0, open)).trim();
  const close = frame.lastIndexOf(')');
  const location = open === -1 ? '' : frame.slice(open + 1, close === -1 ? undefined : close).trim();
  return prefixes.some((p) => symbol.startsWith(p) || (location !== '' && location.startsWith(p)));
}

function fingerprintOf(frames: string[], options: GroupOptions): string {
  const normalised = frames.map(normaliseFrame).filter((f) => f !== '');
  const app = normalised.filter((f) => !isLibraryFrame(f, options.ignorePrefixes));
  const chosen = app.length > 0 ? app : normalised;
  return chosen.slice(0, options.topN).join('\n');
}

export function groupCrashes(reports: CrashReport[], options: GroupOptions): CrashGroup[] {
  const groups = new Map<string, CrashGroup>();
  for (const report of reports) {
    const fingerprint = fingerprintOf(report.frames, options);
    const group = groups.get(fingerprint);
    if (group) {
      group.count += 1;
      group.firstSeen = Math.min(group.firstSeen, report.timestamp);
      group.lastSeen = Math.max(group.lastSeen, report.timestamp);
      group.reportIds.push(report.id);
    } else {
      groups.set(fingerprint, {
        fingerprint,
        count: 1,
        firstSeen: report.timestamp,
        lastSeen: report.timestamp,
        reportIds: [report.id],
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.firstSeen - b.firstSeen ||
      (a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0),
  );
}
