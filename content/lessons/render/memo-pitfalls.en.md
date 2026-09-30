---
id: render-memo-pitfalls
topic: render/memo
kind: pitfall
readMinutes: 4
---
## TL;DR
`React.memo` skips a render only when every prop is equal by `Object.is`. Most memo bugs come from two mistakes: breaking that check by accident with a new reference, or keeping a reference stable when its content should have changed.

## Under the hood
When the parent renders, React shallow-compares each prop of the memoized component. A single new reference is enough to re-render the child. The reverse also holds: if a prop keeps its reference while its content changes, the child skips a render it needed. `useCallback` and `useMemo` keep references stable, but they do not prevent renders by themselves. A context update reaches every component that reads it with `useContext`, memoized or not.

## Interview angle
- "Does useCallback prevent re-renders?" No. It only helps when a memoized child or a dependency array compares the function.
- "When should you not use memo?" When props nearly always change, or the component is cheap to render. Then the comparison costs more than it saves.
- "A memoized row still re-renders. Where do you look first?" At the Profiler's reason for the render, then at which prop received a new reference and where it was created.

## Common pitfalls
- Passing an inline arrow function to a memoized row inside `renderItem`
- Passing the whole `selected` state instead of an `isSelected` boolean
- Building `data` with `map` and spread on every render, which gives every item a new identity
- Leaving a value out of the deps to keep a callback stable, so the callback reads stale state
- Mutating an item in place: the reference stays the same, so the memoized row skips the update
- Writing an inline `value={{ user, signOut }}` on a provider, which re-renders every consumer each time the provider renders
- Forgetting that a context change still re-renders a memoized component

## Related
`render-memo-core`, `performance/lists`
