---
id: render-memo-pitfalls
topic: render/memo
kind: pitfall
readMinutes: 6
---
## TL;DR
`React.memo` skips a render only when **every prop is equal by `Object.is`**. A function or object created during render defeats it.

## Under the hood
When the parent renders, React shallow-compares each prop of the memoized component. A single new reference is enough to re-render the child. `useCallback` and `useMemo` keep references stable, but they do not prevent renders by themselves.

## Interview angle
- "Does useCallback prevent re-renders?" No. It only helps together with a memoized child.
- "When should you *not* use memo?" When props nearly always change, or the component is too cheap to render. Then the comparison costs more than it saves.

## Common pitfalls
- Passing inline arrow functions in `renderItem`
- Passing the whole `selected` state instead of an `isSelected` boolean
- Forgetting that a context change still re-renders a memoized component

## Related
`performance/lists`
