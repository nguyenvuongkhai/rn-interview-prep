import { decideUpdate } from './solution';

test('picks force, soft or none from the two thresholds', () => {
  expect(decideUpdate('1.4.0', '1.6.0', '1.5.0')).toBe('force');
  expect(decideUpdate('1.5.2', '1.6.0', '1.5.0')).toBe('soft');
  expect(decideUpdate('1.6.0', '1.6.0', '1.5.0')).toBe('none');
}, { category: 'basic' });

test('compares each part as a number, not as text', () => {
  expect(decideUpdate('2.9.5', '2.11.0', '2.10.0')).toBe('force');
  expect(decideUpdate('2.10.3', '2.11.0', '2.10.0')).toBe('soft');
  expect(decideUpdate('10.0.0', '10.0.0', '9.12.0')).toBe('none');
}, { category: 'basic' });

test('a missing patch counts as zero', () => {
  expect(decideUpdate('3.1', '3.1.0', '3.0')).toBe('none');
  expect(decideUpdate('3.1', '3.2', '3.1.1')).toBe('force');
}, { category: 'edge-case' });

test('a prerelease is lower than its release', () => {
  expect(decideUpdate('4.0.0-beta.3', '4.0.0', '3.0.0')).toBe('soft');
  expect(decideUpdate('4.0.0-rc.1', '4.1.0', '4.0.0')).toBe('force');
  expect(decideUpdate('4.0.0', '4.0.0-rc.2', '3.9.0')).toBe('none');
}, { category: 'edge-case', hidden: true });

test('prerelease identifiers compare as numbers, then as text', () => {
  expect(decideUpdate('4.0.0-beta.2', '4.0.0-beta.10', '1.0.0')).toBe('soft');
  expect(decideUpdate('4.0.0-beta.10', '4.0.0-beta.2', '1.0.0')).toBe('none');
  expect(decideUpdate('4.0.0-alpha', '4.0.0-alpha.1', '1.0.0')).toBe('soft');
  expect(decideUpdate('4.0.0-rc.1', '4.0.0-beta.5', '1.0.0')).toBe('none');
  expect(decideUpdate('4.0.0-1', '4.0.0-alpha', '1.0.0')).toBe('soft');
}, { category: 'edge-case', hidden: true });

test('a build ahead of the store is left alone, and force beats soft', () => {
  expect(decideUpdate('5.3.0', '5.2.1', '5.0.0')).toBe('none');
  expect(decideUpdate('4.9.9', '5.2.1', '5.0.0')).toBe('force');
}, { category: 'edge-case', hidden: true });
