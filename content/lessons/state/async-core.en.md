---
id: state-async-core
topic: state/async
kind: core
readMinutes: 6
---
## TL;DR
Most async bugs in an RN app are not about slow code but about order: a response that lands after a newer one, a callback that reads values from an old render, a retry wave that hits the server all at once. Promises cannot be cancelled, and React does not ignore results from an earlier effect run, so guarding against stale work is your job. Decide for every async flow which result is allowed to win.

## Under the hood
### Tasks and microtasks
Synchronous code runs to the end first. Then the engine drains the microtask queue, which holds promise callbacks and the code after each `await`. Only then does the next task run, such as a `setTimeout` callback. So `setTimeout(fn, 0)` never runs before an already resolved `.then`, and a long microtask chain can hold back timers and event handling.

### Races in effects
Each run of an effect that starts a request creates an independent promise. If `query` changes from `re` to `react` and the first response is slower, it resolves last and overwrites the newer result. Guard it in the cleanup:

```ts
useEffect(() => {
  const controller = new AbortController();
  fetchResults(query, controller.signal)
    .then(setResults)
    .catch((e: Error) => {
      if (e.name !== 'AbortError') setError(e);
    });
  return () => controller.abort();
}, [query]);
```

RN's `fetch` honours `signal`; aborting rejects the pending promise with `AbortError`. For promises you cannot abort, a local `ignore` flag set in the cleanup does the same job. Abort only stops the app waiting: the server may already have applied a write.

### Stale closures
A callback sees the values of the render that created it. An interval set up in an effect with `[]` deps reads the first render's state forever. Use a functional updater for state, a ref for values you only read, or, from React 19.2, `useEffectEvent`.

### Combinators
- `Promise.all` rejects on the first failure and does not stop the others.
- `Promise.allSettled` waits for every entry and reports each outcome, which suits screens with independent widgets.
- `Promise.race` settles with the first to settle; `Promise.any` resolves with the first to succeed.
- `Promise.all` keeps results in input order, not execution order. Ordered work needs a `for...of` loop with `await`.

### Retries, background and shared work
Retry only idempotent requests, with exponential backoff, a cap and random jitter, so clients that failed together do not retry together. Share one in-flight promise for work that must happen once, such as a token refresh. On iOS a backgrounded app is usually suspended within seconds, so work that must finish belongs in a native background mechanism.

## Interview angle
- "The search list sometimes shows results for an older query." Explain latest-wins and the cleanup guard.
- "Users are logged out randomly." Look for parallel requests each refreshing the token.
- "Design an optimistic like that works offline." Persisted outbox, desired state rather than toggles, idempotent requests, backoff with jitter, rollback on a 4xx.

## Common pitfalls
- Setting state from a request with no cleanup guard
- Treating `AbortError` as a real failure and showing an error screen
- Reading state inside an interval or listener created once
- Using `forEach` with an async callback for ordered work
- Expecting `Promise.all` to cancel the rest, or to wait for all
- Retrying without jitter, or retrying non-idempotent writes
- Several callers each starting the same refresh or upload

## Related
`render-memo-core`, `render/effects`, `state/redux-saga`, `map-limit`
