import { describe, expect, it } from 'vitest';
import { execute } from './execute';

const solution = `export function add(a: number, b: number): number {
  console.log('adding', a, b);
  return a + b;
}`;

const tests = `import { add } from './solution';
test('adds', () => { expect(add(1, 2)).toBe(3); });
test('adds hidden', () => { expect(add(2, 2)).toBe(4); }, { category: 'edge-case', hidden: true });
test('fails', () => { expect(add(1, 1)).toBe(3); });`;

describe('execute', () => {
  it('runs only visible tests when asked', async () => {
    const out = await execute({ solution, tests, include: 'visible' });
    expect(out.results.map((r) => [r.name, r.pass])).toEqual([['adds', true], ['fails', false]]);
    expect(out.results[1].error).toBe('Expected 3, received 2');
    expect(out.error).toBeUndefined();
  });

  it('runs hidden tests too with include all', async () => {
    const out = await execute({ solution, tests, include: 'all' });
    expect(out.results.map((r) => [r.name, r.hidden])).toEqual([['adds', false], ['adds hidden', true], ['fails', false]]);
  });

  it('captures console output', async () => {
    const out = await execute({ solution, tests, include: 'visible' });
    expect(out.logs[0]).toBe('adding 1 2');
  });

  it('reports the planned tests before running them', async () => {
    const planned: string[] = [];
    await execute({ solution, tests, include: 'visible' }, { onPlan: (list) => planned.push(...list.map((t) => t.name)) });
    expect(planned).toEqual(['adds', 'fails']);
  });

  it('reports syntax errors without running anything', async () => {
    const out = await execute({ solution: 'export function (', tests, include: 'all' });
    expect(out.error).toMatch(/^Syntax error/);
    expect(out.results).toEqual([]);
  });

  it('only lets tests import the solution', async () => {
    const out = await execute({ solution, tests: `import fs from 'fs';\ntest('t', () => {});`, include: 'all' });
    expect(out.error).toContain('Cannot import "fs"');
  });
});
