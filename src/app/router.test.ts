import { describe, expect, it } from 'vitest';
import { href, parseRoute, type Route } from './router';

describe('router', () => {
  it('falls back to today for empty or unknown hashes', () => {
    expect(parseRoute('')).toEqual({ name: 'today' });
    expect(parseRoute('#/')).toEqual({ name: 'today' });
    expect(parseRoute('#/test')).toEqual({ name: 'today' });
    expect(parseRoute('#/nope/x')).toEqual({ name: 'today' });
    expect(parseRoute('#/test/%E0')).toEqual({ name: 'today' });
  });

  it('parses session routes', () => {
    expect(parseRoute('#/test/abc')).toEqual({ name: 'test', sessionId: 'abc' });
    expect(parseRoute('#/result/a%20b')).toEqual({ name: 'result', sessionId: 'a b' });
  });

  it('parses the library, lesson, progress and settings routes', () => {
    expect(parseRoute('#/library')).toEqual({ name: 'library' });
    expect(parseRoute('#/lesson/render-memo-pitfalls')).toEqual({ name: 'lesson', lessonId: 'render-memo-pitfalls' });
    expect(parseRoute('#/lesson')).toEqual({ name: 'today' });
    expect(parseRoute('#/progress')).toEqual({ name: 'progress' });
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
  });

  it('href round-trips through parseRoute', () => {
    const routes: Route[] = [
      { name: 'today' },
      { name: 'test', sessionId: 'x/y' },
      { name: 'result', sessionId: 'id-1' },
      { name: 'library' },
      { name: 'lesson', lessonId: 'l-1' },
      { name: 'progress' },
      { name: 'settings' },
    ];
    for (const r of routes) expect(parseRoute(href(r))).toEqual(r);
  });
});
