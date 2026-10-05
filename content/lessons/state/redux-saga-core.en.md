---
id: state-redux-saga-core
topic: state/redux-saga
kind: core
readMinutes: 6
---
## TL;DR
A saga is a generator that yields effects: plain objects describing work, which the saga middleware executes. That makes sagas testable step by step and gives you a task tree with real cancellation. The price is that errors also travel up that tree: one uncaught error in a worker can stop every saga in the app. Today, reach for RTK Query or the listener middleware first, and keep sagas for long workflows.

## Under the hood
### Effects are data
`yield call(api.fetchUser, id)` does not call anything. `call` returns an object with `type: 'CALL'` and the function and arguments; the middleware invokes it, waits for the promise, and passes the result back in through `next()`. A test can step the generator with `gen.next()` and compare each yielded effect, or run the saga against a mocked API with redux-saga-test-plan (`expectSaga`) or `runSaga`.

### call, fork, spawn
- `call` blocks until the function or generator returns. Wrap it in `try/catch` to handle errors.
- `fork` starts an attached task and returns at once. If a fork throws, the parent aborts, its running effect and other forks are cancelled, and the error is thrown out of the parent. A `try/catch` around `yield fork(...)` cannot catch it.
- `spawn` starts a detached task: its errors stay with it, and cancelling the parent does not touch it.

### Helpers
- `takeEvery` forks a worker per action; workers run concurrently and can finish out of order.
- `takeLatest` cancels the previous worker when a new action arrives. Right for search.
- `takeLeading` ignores new actions while a worker runs. Right for a Pay button.
- `actionChannel` buffers actions so a `take` then `call` loop handles them one at a time, in order.

### Cancellation
`cancel(task)`, `takeLatest` and the loser of a `race` all cancel a task. The current effect and attached forks are cancelled, then the generator returns, so only `finally` runs, never `catch`. Inside `finally`, `yield cancelled()` tells you why you are there. A `fetch` keeps running unless you abort it: call `controller.abort()` in `finally`, or attach a `[CANCEL]` method (imported from `redux-saga`) to the promise.

### Channels
`eventChannel(subscribe, buffer?)` turns callbacks such as NetInfo, AppState or a websocket into something you can `take` from. `subscribe` must return the unsubscribe function, which runs on `chan.close()` or `emit(END)`. Without a buffer, events emitted while the saga is busy are dropped. Cancelling the watcher does not close the channel; call `chan.close()` in `finally`.

### Combinators
`all` starts every effect at once; if one fails, the rest are cancelled and the error is thrown. `race` resolves with the first winner and cancels the others, which is how you build timeouts with `delay`. `select` reads state at that moment only, so read it again inside long loops.

## Interview angle
- "Why sagas over thunks?" Declarative effects, cancellation down a task tree, `race`, channels. Then say when you would not use them.
- "All sagas stopped after one network error." The error bubbled to the root. Use `try/catch` in every worker, report through the `onError` option of `createSagaMiddleware`, and consider `spawn` with a bounded restart for root watchers.

## Common pitfalls
- A worker with no `try/catch` taking down the whole root saga
- `call` on a polling loop, so the next `take` is never reached
- `takeEvery` for search, so stale responses win
- Expecting `catch` to run on cancellation, or cancellation to abort `fetch`
- Forgetting `chan.close()`, which leaks native listeners
- Caching a token from `select` outside a long loop

## Related
`state/async`, `state/redux`
