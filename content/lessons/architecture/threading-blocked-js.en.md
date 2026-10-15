---
id: arch-threading-blocked-js
topic: architecture/threading
kind: core
readMinutes: 5
---
## TL;DR
All your JavaScript runs on **one JS thread**. When it's busy (a big `JSON.parse`, heavy mapping, a huge render), taps wait and JS-driven animations freeze. Anything on the **UI thread** keeps running.

## Under the hood
| Thread | What runs there |
| --- | --- |
| JS thread | React renders, state updates, `onPress` handlers, `JSON.parse`, timers |
| UI (main) thread | Native drawing, touch input, native-driven animations |
| Background thread | Layout (Yoga) and, in Fabric, preparing the new view tree |

- **Taps feel delayed:** native receives the touch, but `onPress` waits in the JS queue.
- **Spinner freezes:** a JS-driven animation (`useNativeDriver: false`) needs JS for every frame. The native `ActivityIndicator` keeps spinning.
- **Not the bridge:** JSI removes serialization costs, but your own JavaScript still runs on one thread.

## Interview angle
- "How do you confirm it?" Perf Monitor in a release build: JS FPS drops while UI FPS stays near 60.
- "How do you fix it?" In order: do less work (server pagination, only the fields you need), chunk or defer the rest (yield between chunks, `requestIdleCallback`, `startTransition`), render in a virtualized list, move animations to the UI thread (`useNativeDriver: true`, Reanimated), and move heavy processing into a native module or a background thread.
- "Can you chunk `JSON.parse`?" No. Shrink the response instead.

## Common pitfalls
- Blaming the bridge on the New Architecture
- Custom spinners built with `useNativeDriver: false`
- Mapping thousands of items into a `ScrollView` right after the fetch

## Related
`architecture/new-arch`, `performance/lists`
