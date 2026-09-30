export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

const FENCE = /^```(\w*)\s*$/;
const FENCE_END = /^```\s*$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^[-*]\s+/;
const BLOCK_START = /^(```|#{1,3}\s|[-*]\s)/;

/** The subset challenge prompts and lessons use: headings, paragraphs, bullet lists, code fences. Inline `code` is left to <Rich>. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE_END.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ kind: 'code', lang: fence[1], text: body.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      i++;
      continue;
    }
    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) items.push(lines[i++].replace(BULLET, '').trim());
      blocks.push({ kind: 'list', items });
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) paragraph.push(lines[i++].trim());
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}
