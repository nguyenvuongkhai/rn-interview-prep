---
id: typescript-generics-core
topic: typescript/generics
kind: core
readMinutes: 6
---
## TL;DR
A generic keeps the relation between input and output: `first<T>(items: T[]): T | undefined` returns `number | undefined` for a `number[]`, while an `any` version returns `any` and switches checking off. Generics and utility types exist only at compile time. They never validate runtime data, and most bugs come from forgetting that or from expecting more of a utility type than it does.

## Under the hood
### Inference and widening
When `T` is inferred from a literal such as `'idle'`, it widens to `string` if `T` has no primitive constraint and does not sit at the top level of the return type. To keep literals, use `T extends string` or a `const` type parameter (TS 5.0+): `function routes<const T extends readonly string[]>(r: T): T` infers `readonly ['home', 'profile']` for `routes(['home', 'profile'])`. `NoInfer<T>` (TS 5.4) stops one parameter from taking part in inference. Defaults work like default arguments: `type ApiResponse<T = unknown>` means `ApiResponse` is `ApiResponse<unknown>`.

### Constraints, keyof and indexed access
`K extends keyof T` with a return type of `T[K]` gives typed `getField`, `pick` or `groupBy` helpers; returning `T[keyof T]` throws `K` away and every call gets the union of all values. A type parameter used only once links nothing.

### Built-in utility types
`Partial`, `Required` and `Readonly` are mapped types and they are shallow: `Readonly<Settings>` still lets you write `s.flags.beta`. `Pick` requires real keys, but `Omit` accepts any `PropertyKey`, so a typo is silent. `Omit` is also not distributive: on a union it keeps only the shared keys and loses the discriminant. `Record<K, V>` with a literal union makes every key required. `Exclude` and `Extract` filter unions, `NonNullable` drops `null` and `undefined`, `Parameters` and `ReturnType` read function types, and `Awaited` (TS 4.5+) unwraps Promises.

### Mapped, template literal and conditional types
Key remapping with a template literal type turns an event map into handler props:

```ts
type Handlers<E> = {
  [K in keyof E as `on${Capitalize<K & string>}`]?: (payload: E[K]) => void;
};
```

A conditional type with a naked type parameter, `T extends U ? X : Y`, distributes over unions: `ListOf<'a' | 'b'>` becomes `'a'[] | 'b'[]`. Wrap both sides, `[T] extends [U]`, to stop that. `infer` extracts a part of a type, which is how `ReturnType` is built.

### Generic components and API clients
In `.tsx`, write `<T,>` on arrow functions so the parser does not read a JSX tag. JSX infers `T` from props, so `<List data={users} renderItem={(u) => u.name} />` types `u` as `User`. `React.memo` loses the generic; cast the result to `typeof List`. A `get<T>(url)` that ends in `res.json() as T` is an unchecked cast: validate at the boundary with a schema such as zod and derive the type from it.

## Interview angle
- "Why a generic and not `any`?" Talk about linking input to output, and that the emitted JS is the same.
- "Write a typed `pick`." Use `K extends keyof T` and `Pick<T, K>`, then explain why `Omit` does not check keys.
- "Is your API client type-safe?" Say no, unless responses are validated; the generic is a promise, not a check.

## Common pitfalls
- Assuming `Readonly`, `Partial` or `Required` are deep
- Using `Omit` on a union and losing narrowing
- Returning `T[keyof T]` instead of `T[K]`
- A conditional type that distributes when you did not want it to
- `as T` in a fetch helper treated as validation
- Wrapping a generic component in `React.memo` and losing `T`
- Type gymnastics nobody on the team can read or debug

## Related
`typescript-types-core`, `typescript-react-core`, `state-redux-core`
