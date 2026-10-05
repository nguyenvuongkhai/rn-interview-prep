import { s } from './solution';

test('primitives accept their type and reject others', () => {
  expect(s.string().safeParse('hi')).toEqual({ success: true, data: 'hi' });
  expect(s.number().safeParse(3)).toEqual({ success: true, data: 3 });
  expect(s.boolean().safeParse(false)).toEqual({ success: true, data: false });
  expect(s.number().safeParse('3')).toEqual({ success: false, issues: [{ path: [], message: 'Expected number' }] });
  expect(s.literal('admin').safeParse('user')).toEqual({ success: false, issues: [{ path: [], message: 'Expected "admin"' }] });
  expect(s.literal(2).safeParse(2)).toEqual({ success: true, data: 2 });
}, { category: 'basic' });

test('objects validate nested shapes and drop unknown keys', () => {
  const User = s.object({ id: s.string(), profile: s.object({ age: s.number() }), tags: s.array(s.string()) });
  expect(User.safeParse({ id: 'u1', profile: { age: 30, avatar: 'x.png' }, tags: ['a'], token: 'secret' })).toEqual({
    success: true,
    data: { id: 'u1', profile: { age: 30 }, tags: ['a'] },
  });
}, { category: 'basic' });

test('collects every issue with its path', () => {
  const User = s.object({ id: s.string(), tags: s.array(s.string()), profile: s.object({ age: s.number() }) });
  expect(User.safeParse({ id: 1, tags: ['a', 2, 'c', false], profile: { age: 'x' } })).toEqual({
    success: false,
    issues: [
      { path: ['id'], message: 'Expected string' },
      { path: ['tags', 1], message: 'Expected string' },
      { path: ['tags', 3], message: 'Expected string' },
      { path: ['profile', 'age'], message: 'Expected number' },
    ],
  });
}, { category: 'edge-case' });

test('NaN, null and arrays are rejected where they look close enough', () => {
  expect(s.number().safeParse(NaN)).toEqual({ success: false, issues: [{ path: [], message: 'Expected number' }] });
  const Box = s.object({ size: s.number() });
  expect(Box.safeParse(null)).toEqual({ success: false, issues: [{ path: [], message: 'Expected object' }] });
  expect(Box.safeParse([1])).toEqual({ success: false, issues: [{ path: [], message: 'Expected object' }] });
  expect(s.array(s.number()).safeParse({ 0: 1, length: 1 })).toEqual({ success: false, issues: [{ path: [], message: 'Expected array' }] });
  expect(Box.safeParse({})).toEqual({ success: false, issues: [{ path: ['size'], message: 'Expected number' }] });
}, { category: 'edge-case', hidden: true });

test('optional accepts undefined and a missing key, but not a wrong type', () => {
  const Params = s.object({ id: s.string(), tab: s.literal('posts').optional() });
  expect(Params.safeParse({ id: 'u1' })).toEqual({ success: true, data: { id: 'u1' } });
  expect(Params.safeParse({ id: 'u1', tab: undefined })).toEqual({ success: true, data: { id: 'u1', tab: undefined } });
  expect(Params.safeParse({ id: 'u1', tab: 'likes' })).toEqual({ success: false, issues: [{ path: ['tab'], message: 'Expected "posts"' }] });
  expect(s.string().optional().safeParse(undefined)).toEqual({ success: true, data: undefined });
}, { category: 'edge-case', hidden: true });

test('returns new values and leaves the input untouched', () => {
  const input = { items: [{ id: 'a', extra: 1 }], meta: 'x' };
  const List = s.object({ items: s.array(s.object({ id: s.string() })) });
  const result = List.safeParse(input);
  expect(result).toEqual({ success: true, data: { items: [{ id: 'a' }] } });
  expect(input).toEqual({ items: [{ id: 'a', extra: 1 }], meta: 'x' });
  if (result.success) {
    expect(result.data.items === input.items).toBe(false);
  }
}, { category: 'edge-case', hidden: true });
