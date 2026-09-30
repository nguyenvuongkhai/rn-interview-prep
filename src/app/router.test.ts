import { describe, expect, it } from 'vitest';
import { href, parseRoute } from './router';

describe('router', () => {
  it('falls back to today for empty or unknown hashes', () => {
    expect(parseRoute('')).toEqual({ name: 'today' });
    expect(parseRoute('#/')).toEqual({ name: 'today' });
    expect(parseRoute('#/test')).toEqual({ name: 'today' });
    expect(parseRoute('#/nope/x')).toEqual({ name: 'today' });
  });

  it('parses test and result routes', () => {
    expect(parseRoute('#/test/abc')).toEqual({ name: 'test', sessionId: 'abc' });
    expect(parseRoute('#/result/a%20b')).toEqual({ name: 'result', sessionId: 'a b' });
  });

  it('href round-trips through parseRoute', () => {
    for (const r of [{ name: 'today' }, { name: 'test', sessionId: 'x/y' }, { name: 'result', sessionId: 'id-1' }] as const) {
      expect(parseRoute(href(r))).toEqual(r);
    }
  });
});
