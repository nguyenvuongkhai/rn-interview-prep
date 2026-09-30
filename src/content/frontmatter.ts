export interface Frontmatter {
  data: Record<string, string>;
  body: string;
}

/** Flat `key: value` frontmatter only — lessons need nothing richer. */
export function parseFrontmatter(src: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(src);
  if (!match) throw new Error('Missing frontmatter block');

  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon === -1) throw new Error(`Bad frontmatter line: ${line}`);
    data[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { data, body: match[2] };
}
