import type { Lesson } from '../core/schema';

const H1 = /^#\s+(.+?)\s*$/;

/** A lesson may open with `# Title`. Labs do, since one topic can have several. */
export function splitTitle(body: string): { title?: string; rest: string } {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  const match = first === -1 ? null : H1.exec(lines[first].trim());
  if (!match) return { rest: body };
  return { title: match[1], rest: lines.slice(first + 1).join('\n') };
}

/** The labs among a question's lessons, in the question's order. */
export function labsFor(lessonIds: string[], lessons: Lesson[]): Lesson[] {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  return lessonIds.flatMap((id) => {
    const lesson = byId.get(id);
    return lesson?.kind === 'lab' ? [lesson] : [];
  });
}
