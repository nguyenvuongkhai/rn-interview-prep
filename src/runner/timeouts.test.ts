import { describe, expect, it } from 'vitest';
import { finishTimedOut } from './timeouts';

describe('finishTimedOut', () => {
  it('marks planned tests that never reported as timed out', () => {
    const planned = [
      { name: 'a', category: 'basic', hidden: false },
      { name: 'b', category: 'edge-case', hidden: true },
    ];
    expect(finishTimedOut(planned, [{ name: 'a', category: 'basic', hidden: false, pass: true }])).toEqual([
      { name: 'a', category: 'basic', hidden: false, pass: true },
      { name: 'b', category: 'edge-case', hidden: true, pass: false, error: 'Timeout' },
    ]);
  });
});
