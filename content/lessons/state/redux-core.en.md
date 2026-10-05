---
id: state-redux-core
topic: state/redux
kind: core
readMinutes: 6
---
## TL;DR
Redux is one store, updated only by pure reducers, with changes detected by reference. Redux Toolkit (RTK) adds Immer, store defaults, async thunks and RTK Query. Most real Redux bugs come from three places: a reference that changes when it should not (extra re-renders), a reference that does not change when it should (missed updates), and state that is not plain serialisable data.

## Under the hood
### Reducers and Immer
A reducer is a pure function `(state, action) => newState`: no side effects, no `Date.now()`, no mutation. Redux and react-redux compare references, so a mutated object looks unchanged and the UI misses the update. `createSlice` runs case reducers through Immer: you edit a draft and Immer produces a new state with structural sharing, so changed objects get new references and untouched ones keep theirs. Pick one style per reducer: modify the draft, or return a new value. Doing both throws. Writing `state = initialState` only rebinds a local variable and does nothing; use `return initialState`.

### configureStore
`configureStore` adds thunk, and outside production it also adds an immutability check and a serialisability check, then enables Redux DevTools. In RTK 2.x (with Redux 5 and react-redux 9), `createReducer` and `extraReducers` only accept the builder callback; the old object syntax was removed. Non-serialisable values such as `Date`, `Map`, class instances or functions trigger warnings, and with redux-persist they come back as plain JSON after a restart.

### useSelector
`useSelector` reruns your selector whenever the root state changes and compares the result with `===`. A selector that builds a new object or array (`filter`, `map`, `{ a, b }`) returns a new reference every time, so the component re-renders after any action that changes any slice. Since react-redux 8.1, development builds warn when a selector returns a different reference for the same input. Fixes: select primitives separately, pass `shallowEqual`, or use `createSelector`, which recomputes only when its inputs change. Keep input selectors as plain lookups and do the work in the result function.

### Normalised state
`createEntityAdapter` stores `{ ids, entities }` with ready-made reducers and selectors. Let a list select `ids` and each row select its own entity by id: updating one entity re-renders one row.

### Async work
`createAsyncThunk` dispatches `pending`, then `fulfilled` or `rejected`. Return `rejectWithValue(x)` to reject with a payload; calling it without `return` dispatches `fulfilled`. `condition` can skip a call. `abort()` only aborts the `signal`; pass it to `fetch` to stop the request. `await dispatch(thunk())` never throws unless you call `.unwrap()`. For server data, RTK Query adds caching by endpoint and argument, request dedup, tags for invalidation and `keepUnusedDataFor`. In RN, `refetchOnFocus` needs `setupListeners` with an `AppState` handler. `createListenerMiddleware` reacts to actions or state changes; a listener that dispatches something its own predicate matches loops.

## Interview angle
- "Why does this component re-render on every action?" Talk about `===`, new references from selectors, and the react-redux dev warning.
- "Redux, Context, Zustand or React Query?" Separate server state from client state first, then justify Redux by shared state with many writers, complex updates and tooling.
- "What breaks with redux-persist?" Shape changes without `createMigrate`, persisting too much, and its actions tripping `serializableCheck`.

## Common pitfalls
- Mutating the draft and returning a new value in the same reducer
- Reassigning `state` instead of returning the new value
- Selectors that return a new object or array on every run
- Calling `rejectWithValue` without `return`
- Storing `Date`, `Map` or class instances in persisted state
- Changing a persisted slice's shape without a migration

## Related
`state-async-core`, `state-redux-saga-core`, `render-memo-core`
