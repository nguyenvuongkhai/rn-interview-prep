## Task
Write `takeLatest(worker)`. It returns an object with:

- `run(arg)`: starts `worker(arg, signal)` and returns a promise of a `RunResult`
- `cancel()`: cancels the run in flight, if any

Only the latest run may finish. When a new `run` starts, the previous one is cancelled: its `AbortSignal` is aborted and its promise resolves to `{ status: 'cancelled' }` straight away, without waiting for its worker.

## Why interviewers ask
A search box fires a request on every keystroke. Responses come back out of order, and the result for "re" lands after the result for "react" and overwrites it. `takeLatest` in redux-saga, `AbortController` in a `useEffect` cleanup and RTK Query's request handling all solve this race. Interviewers want to see that you cancel the request and also ignore a late answer, because not every worker honours the signal.

## Example
```ts
const search = takeLatest((q: string, signal) => api.search(q, { signal }));
const first = search.run('re');
const second = search.run('react');
await first;  // { status: 'cancelled' }
await second; // { status: 'done', value: [...] }
```

## Rules
- The latest run resolves to `{ status: 'done', value }` when its worker resolves, and rejects with the worker's error when it rejects.
- A cancelled run never rejects, and its late value or error is ignored.
- `cancel()` with nothing in flight does nothing. A `run` after `cancel()` works normally.
- Call the worker synchronously inside `run`.
