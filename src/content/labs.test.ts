import { describe, expect, it } from 'vitest';
import type { Lesson } from '../core/schema';
import { labsFor, splitTitle } from './labs';

const L = (s: string) => ({ vi: s, en: s });
const lesson = (id: string, kind: Lesson['kind']): Lesson => ({ id, topic: 'render/memo', kind, readMinutes: 10, body: L('x') });

describe('splitTitle', () => {
  it('takes the first line when it is a level-1 heading', () => {
    expect(splitTitle('\n# Prove memo works\n\n## The case\nText')).toEqual({ title: 'Prove memo works', rest: '\n## The case\nText' });
  });

  it('leaves a body without a level-1 heading alone', () => {
    expect(splitTitle('## TL;DR\nText')).toEqual({ rest: '## TL;DR\nText' });
    expect(splitTitle('Intro\n# Late heading')).toEqual({ rest: 'Intro\n# Late heading' });
  });
});

describe('labsFor', () => {
  it('returns only the labs among the given lesson ids, in that order', () => {
    const lessons = [lesson('a-core', 'core'), lesson('a-lab', 'lab'), lesson('b-lab', 'lab')];
    expect(labsFor(['b-lab', 'a-core', 'a-lab', 'missing'], lessons).map((l) => l.id)).toEqual(['b-lab', 'a-lab']);
  });
});
