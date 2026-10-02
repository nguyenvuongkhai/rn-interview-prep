export type UpdateMode = 'none' | 'soft' | 'force';

type Version = { core: number[]; pre: string[] };

function parse(version: string): Version {
  const dash = version.indexOf('-');
  const main = dash === -1 ? version : version.slice(0, dash);
  const pre = dash === -1 ? [] : version.slice(dash + 1).split('.');
  const [major = 0, minor = 0, patch = 0] = main.split('.').map(Number);
  return { core: [major, minor, patch], pre };
}

const isNumeric = (id: string) => /^\d+$/.test(id);

function compareIdentifiers(a: string, b: string): number {
  if (isNumeric(a) && isNumeric(b)) return Number(a) - Number(b);
  if (isNumeric(a)) return -1;
  if (isNumeric(b)) return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function comparePrerelease(a: string[], b: string[]): number {
  // no prerelease ranks above any prerelease of the same core version
  if (a.length === 0 || b.length === 0) return b.length - a.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i >= a.length) return -1;
    if (i >= b.length) return 1;
    const diff = compareIdentifiers(a[i], b[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function compareVersions(a: string, b: string): number {
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = left.core[i] - right.core[i];
    if (diff !== 0) return diff;
  }
  return comparePrerelease(left.pre, right.pre);
}

export function decideUpdate(installed: string, latest: string, minSupported: string): UpdateMode {
  if (compareVersions(installed, minSupported) < 0) return 'force';
  if (compareVersions(installed, latest) < 0) return 'soft';
  return 'none';
}
