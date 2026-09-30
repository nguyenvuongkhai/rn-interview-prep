---
id: render-memo-core
topic: render/memo
kind: core
readMinutes: 6
---
## TL;DR
A component re-renders when its own state changes, when a context it reads changes, or when its parent renders. `React.memo`, `useMemo` and `useCallback` do not stop rendering by themselves. They keep references stable so that a later `Object.is` check can succeed. Memoization is a performance hint, not a guarantee, and it only pays off when something actually compares those references.

## Under the hood
### React.memo
When the parent renders, React compares each prop of a memoized component with its previous value using `Object.is`. If every prop is equal, React can reuse the last result. A second argument, `arePropsEqual(prev, next)`, replaces that check and returns `true` when the props count as equal. It runs only on re-renders caused by the parent, never on mount, and it never sees state or context: an update to the component's own state, or to a context it reads, re-renders it anyway.

### useMemo and useCallback
`useMemo(fn, deps)` stores the last result and the last deps. On the next render React compares each dep with `Object.is`. If all match, it returns the stored result; otherwise it calls `fn` again. It keeps only the most recent entry, not a history. `useCallback(fn, deps)` is the same idea, with the function itself as the stored value.

```ts
const visible = useMemo(() => filterMessages(messages, query), [messages, query]);
const onSelect = useCallback((id: string) => setSelectedId(id), []);
```

React may throw the cache away, for example when a component suspends during its first mount, and Strict Mode calls the calculation twice in development. Your code must stay correct if the value is recomputed, so keep the function pure and never put side effects in it.

### Identity is the whole game
An object literal, array literal, inline function or JSX element created during render is a new reference every time. That includes `children`. When the parent renders `<Card><Text>Hi</Text></Card>`, the `Text` element is new, so `React.memo(Card)` never skips unless that element is memoized too.

A context provider follows the same rule. If the value is an inline `{ user, signOut }`, every consumer re-renders each time the provider renders. Memoize the value, or split it into contexts that change at different rates.

### React Compiler
React Compiler is a build-time Babel plugin. It analyses components and hooks that follow the Rules of React and inserts memoization for values, callbacks and JSX automatically. It skips code where it detects a violation, but it cannot detect every one, so keep the React Hooks lint rules on. Existing `useMemo` and `useCallback` calls keep working, so you do not need to delete them before enabling it.

## Interview angle
- "Does `useCallback` prevent a re-render?" No. It keeps a function's identity stable, and that helps only when a memoized child or a dependency array compares it.
- "When is `useMemo` worth it?" When the calculation is measurably expensive, or when its identity feeds `React.memo` or another hook's deps.
- "What changes with React Compiler?" New code rarely needs manual memoization, but you still follow the Rules of React and still profile. The compiler cannot make work cheaper when its inputs really change.

## Common pitfalls
- Wrapping a component in `React.memo` while passing it inline objects, callbacks or `children`
- Leaving a value out of the deps to keep a callback stable, so it reads stale state
- Writing a custom `arePropsEqual` that ignores callback props, which creates the same stale closures
- Mutating an object in place: the reference stays the same, so memoized children skip the update
- Assuming `React.memo` shields a component from context changes

## Related
`render-memo-pitfalls`, `render/effects`, `performance/lists`
