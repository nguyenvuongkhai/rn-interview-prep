---
id: typescript-types-core
topic: typescript/types
kind: core
readMinutes: 6
---
## TL;DR
TypeScript checks the shape of values in your code, then disappears: types are erased before the bundle runs. Most real type bugs come from places where the compiler trusts you instead of checking: `as`, `!`, `any`, a type guard with wrong logic, and data arriving from outside. Model states as discriminated unions, narrow before use, and validate at runtime wherever data enters the app.

## Under the hood
### Structural typing and excess property checks
Types are compared by structure, not by name, so extra properties are allowed. The one exception is a fresh object literal assigned straight to a type, which gets an excess property check (`Object literal may only specify known properties`). Through a variable, the typo `colour` slips past.

### any, unknown and narrowing
`any` switches checking off; `unknown` accepts anything but allows nothing until you narrow. `res.json()` and `JSON.parse` return `any`; assign them to `unknown` instead. Since TypeScript 4.4, `strict` enables `useUnknownInCatchVariables`, so `catch (e)` gives `unknown` and you narrow with `e instanceof Error`. Narrow with `typeof`, `instanceof`, `'key' in value`, equality or truthiness, which also drops `0` and `''`, so test `=== null` when those are valid values. A user-defined guard `value is T` is trusted, not verified: a guard that returns `true` too broadly lies to the compiler.

### Discriminated unions and never
Flags such as `isLoading` and `isError` allow impossible combinations. A union `{ status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: string }` makes `data` reachable only after checking `status`. In a `switch`, call `assertNever(state)` in `default`, where `assertNever(x: never)` throws: a new member that is not handled becomes a compile error. Writing `state as never` silences exactly that error.

### Assertions, satisfies and literals
`as` is unchecked; it fails only when the types do not overlap at all, and `x as unknown as T` bypasses even that. An annotation replaces the inferred type. `satisfies` (TypeScript 4.9+) checks the value against a type but keeps the narrower inferred type, so a config typed `Record<string, string>` still knows its keys. `as const` keeps readonly literal types such as `'/'`.

### interface, type and enums
`interface` declarations with the same name merge, which is how libraries are augmented; `type` aliases cannot be redeclared, and only `type` can express unions. `interface extends` reports an incompatible property at the declaration, while `&` silently produces `never`. A regular `enum` emits a runtime object and string enums are nominal, so `'dark'` is not a `Theme`; numeric enums still accept any `number`. A union of string literals is erased and needs no import.

### Strictness flags
`strict` includes `strictNullChecks` and `noImplicitAny`. Not part of `strict`: `noUncheckedIndexedAccess` makes `arr[i]` and `record[key]` possibly `undefined`, and `exactOptionalPropertyTypes` stops `prop?: string` from accepting an explicit `undefined`. `?.` handles a missing value; `!` only deletes `undefined` from the type.

## Interview angle
- "Why did a strictly typed screen crash on API data?" Types are erased; validate at the boundary with zod and derive the type with `z.infer`.
- "How do you model request state?" A discriminated union plus an exhaustive `switch`.
- "`any` or `unknown`? `satisfies` or `as`?" Prefer what the compiler checks.

## Common pitfalls
- Asserting API responses with `as` instead of validating them
- A type guard that only checks `typeof value === 'object'`
- Truthiness narrowing that treats `0` or `''` as missing
- `as never` or `!` silencing the check you depend on
- Boolean flags instead of a discriminated union
- Assuming excess property checks run on every assignment

## Related
`typescript-generics-core`, `typescript-react-core`, `state-async-core`
