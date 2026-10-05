---
id: performance-js-thread-core
topic: performance/js-thread
kind: core
readMinutes: 6
---
## TL;DR
React, your handlers and JS-driven animations share one JS thread, and JS runs each task to completion, so long synchronous work delays all of them. Keep per-frame work off JS, cut event frequency, and split or move heavy work. Measure in release.

## Under the hood
### Threads
- The JS thread runs React render, effects, event handlers and timers.
- The main (UI) thread draws native views, scrolls, and receives touches.
- On the New Architecture (default from RN 0.76), Fabric can compute layout off the main thread, then mounts the result on the main thread.

Perf Monitor in the dev menu shows a UI and a JS frame rate. Low JS with healthy UI means JS is the bottleneck: native scrolling still works, but taps and JS-driven updates lag. Low UI with healthy JS means native work is too heavy, such as oversized images or too many views.

### Frame budget
A frame lasts 1000 ms divided by the refresh rate: about 16.6 ms at 60 Hz and about 8.3 ms at 120 Hz. A handler that fits at 60 Hz can miss frames on a faster screen.

### What blocks JS
`JSON.parse` on a large string, sorting big arrays in render, rendering thousands of rows at once, and re-rendering a large tree on every keystroke. Waiting is not blocking: during `await fetch(...)` or an `<Image>` load, the work is native.

### Keeping motion off JS
- `Animated` with `useNativeDriver: true` sends the animation to native once, so it keeps running while JS is busy; `Animated.event` can wire scroll offset into a transform the same way. The native driver only supports non-layout props such as `transform` and `opacity`; `height` or `top` throws an error.
- Reanimated runs worklets on the UI thread: shared values, `useAnimatedStyle`, `withSpring`. With react-native-gesture-handler, gesture callbacks run there too. Cross back to JS only for the final result, with `runOnJS` (or `scheduleOnRN` from `react-native-worklets` in Reanimated 4).

### Event frequency
Debounce runs once after a burst stops (search). Throttle caps the rate during a burst (scroll-driven checks). `scrollEventThrottle` is the minimum interval in ms between scroll events sent to JS; raise it when you do not need precision.

### Yielding and moving work
- Awaiting a resolved promise only queues a microtask; microtasks drain before taps or a frame are handled. Yield with a macrotask such as `setTimeout(resolve, 0)`, sizing chunks by a time budget.
- `requestAnimationFrame` runs JS before the next frame; it does not make work cheaper.
- `InteractionManager.runAfterInteractions` defers work until running interactions finish; check its status in your RN version's docs.
- `startTransition` and `useDeferredValue` mark expensive updates as non-urgent so input stays responsive. They need the New Architecture, and they still run on the JS thread.
- Move truly heavy work into a native module or a JSI library.

### Measuring
Profile a release build on a low-end device: the Hermes sampling profiler shows where JS time goes, the React DevTools Profiler shows what renders and why.

## Interview angle
- "Typing lags in a long chat." Check which counter drops, profile a keystroke, keep input state local, debounce side effects.
- "This animation stutters when data loads." Ask what drives it; move it to the native driver or a worklet.

## Common pitfalls
- `useNativeDriver: false` on a scroll-driven header
- Creating a debounced function inside render
- Debouncing a visual that must follow the finger
- Using `await Promise.resolve()` to yield
- Putting the input's own state in a transition
- Judging performance from a dev build

## Related
`maintain-regression-core`, `render-memo-core`, `state-async-core`, challenge `debounce`
