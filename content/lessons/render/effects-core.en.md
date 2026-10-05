---
id: render-effects-core
topic: render/effects
kind: core
readMinutes: 6
---
## TL;DR
An effect synchronises a component with something outside React: a subscription, a timer, a native SDK, a network connection. React runs it after committing a render, and runs its cleanup before the next run and on unmount. If nothing external is involved, you probably do not need an effect: compute the value during render, or do the work in the event handler that caused it.

## Under the hood
### Timing
React renders, commits the result to the native view tree, then runs effects. Unless the update came from a discrete interaction such as a tap, the frame is usually shown first. `useLayoutEffect` runs synchronously after commit and before the frame is shown. From RN 0.76 the New Architecture is on by default and layout is computed synchronously, so you can measure a view in `useLayoutEffect` and position a tooltip without a wrong frame. Both hooks run on the JS thread; only the timing differs.

### Cleanup order
When a dep changes, React renders and commits with the new value, runs the previous cleanup with its old closure, then runs the new effect. Two runs of the same effect never overlap. On unmount only the cleanup runs.

```ts
useEffect(() => {
  const sub = Keyboard.addListener('keyboardDidShow', onShow);
  return () => sub.remove();
}, [onShow]);
```

`AppState`, `Keyboard`, `Dimensions` and `NativeEventEmitter` listeners each return a subscription with `remove()`. Remove exactly that one; `removeAllListeners` also removes other components' listeners.

### Deps
Each dep is compared with its previous value using `Object.is`. With no array, the effect runs after every commit. With `[]`, it runs after mount. Objects and functions created during render are new each time, so depend on the primitives the effect really reads, such as `user.id`. Module-level constants, refs and `useState` setters are stable and do not need to be listed.

An effect that sets state can loop: if it re-runs after every render and each run produces a value that differs by `Object.is`, React never settles. Setting the same primitive again bails out.

### Strict Mode
Since React 18, Strict Mode in development runs one extra setup and cleanup cycle on mount. It simulates a real remount. If the user can notice the second run, the cleanup is incomplete. Fix the cleanup rather than guarding with a ref.

### Effect Events
`useEffectEvent`, stable from React 19.2, lets an effect read the latest props or state without listing them in deps. Call it only inside effects, never pass it to other components. Check which React version your RN release ships: RN has React 19 only from 0.78.

## Interview angle
- "Why can't the effect function be `async`?" It would return a Promise, and React expects a cleanup function or nothing. Call an async function inside the effect and use a cancelled flag.
- "Why does my effect keep running after I navigate away?" In a stack, the previous screen stays mounted. Use `useFocusEffect` from React Navigation for work that should stop on blur.
- "When is an effect the wrong tool?" Derived values, resetting state when a prop changes (use a `key`), and logic caused by a specific user action.

## Common pitfalls
- Passing an `async` function to `useEffect`, so the cleanup is lost
- Removing every listener for an event instead of the subscription you created
- Copying derived data into state from an effect, which costs an extra render and a stale frame
- Object or function deps created during render, which re-run the effect every time
- Hiding the Strict Mode double run with a ref instead of fixing the cleanup
- Running screen-scoped work in `useEffect` on a screen that stays mounted in a stack

## Related
`render/memo`, `state/async`, `architecture/new-arch`
