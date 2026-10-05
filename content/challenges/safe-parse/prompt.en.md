## Task
Write a tiny runtime validator, `s`, in the style of zod. It has these builders:

- `s.string()`, `s.number()`, `s.boolean()`
- `s.literal(value)`: only that exact value
- `s.array(item)`: an array whose every element matches `item`
- `s.object(shape)`: an object whose keys match the schemas in `shape`

Every schema has `safeParse(value)`, which returns `{ success: true, data }` or `{ success: false, issues }`, and `optional()`, which returns a schema that also accepts `undefined`. Each issue is `{ path, message }`, where `path` lists the keys and indexes from the root down to the bad value.

## Why interviewers ask
TypeScript types are erased at build time, so `fetch<User>()` or `route.params as Params` is only a promise to the compiler. A backend change or a hand-typed deep link can still put a string where your code expects a number, and the crash surfaces far from the cause. Interviewers want to hear where you validate at the boundary: API responses, deep links, persisted state and native events.

## Example
```ts
const User = s.object({ id: s.string(), age: s.number(), role: s.literal('admin').optional() });
User.safeParse({ id: 'u1', age: 30, extra: true });
// { success: true, data: { id: 'u1', age: 30 } }
User.safeParse({ id: 7, age: 'old' });
// { success: false, issues: [
//   { path: ['id'], message: 'Expected string' },
//   { path: ['age'], message: 'Expected number' } ] }
```

## Rules
- The messages are `Expected string`, `Expected number`, `Expected boolean`, `Expected array` and `Expected object`. For a literal, use `Expected ` followed by `JSON.stringify(value)`, for example `Expected "admin"`.
- `NaN` is not a number. `null` and arrays are not objects.
- Report every issue, not just the first. Order them by shape key order and array index, depth first.
- `object` drops keys that are not in the shape. An optional key that is missing from the input stays missing from `data`.
- `data` is a new value. Never mutate the input.
