## Task
Write `createEmitter<Events>()`, the JS half of a native event bridge. `Events` maps each event name to its payload type, for example `{ progress: number; done: { path: string } }`.

The returned object has:

- `on(event, fn)`: adds a listener and returns an unsubscribe function
- `once(event, fn)`: like `on`, but the listener is removed before its first call
- `emit(event, payload)`: calls the listeners of that event in the order they were added
- `listenerCount(event)`: the number of listeners still registered

## Why interviewers ask
A native module streams progress or battery events into JS, and screens subscribe and unsubscribe while events are in flight. `NativeEventEmitter` reports every subscribe and unsubscribe to the native module, and `RCTEventEmitter` counts them so native code can start and stop the source. The follow-up is always about the edge cases: a listener that unsubscribes itself, a screen that subscribes from inside a handler, a handler that throws.

## Example
```ts
const events = createEmitter<{ progress: number }>();
const off = events.on('progress', (p) => console.log(p));
events.emit('progress', 0.5); // logs 0.5
off();
events.listenerCount('progress'); // 0
```

## Rules
- A listener added during an `emit` does not run in that `emit`, only in later ones.
- A listener removed during an `emit` does not run if its turn has not come yet. Removing any listener, including the one running, must not skip the others.
- Calling an unsubscribe function twice does nothing.
- If listeners throw, every other listener still runs. After all of them ran, `emit` rethrows the first error.
- Registering the same function twice adds two listeners.
