---
id: debug-js-core
topic: debug/js
kind: core
readMinutes: 6
---
## TL;DR
From RN 0.76, React Native DevTools is the default JS debugger: breakpoints, stepping, call stack, scope and console, attached to Hermes on the device. React DevTools inside it shows props, state, hooks and why components rendered. The debugger only works on dev builds, so release-only bugs need logs, source maps and a release build. When the cause is not obvious, shrink the problem: a minimal reproduction, then bisect.

## Under the hood
### The debugger
- React Native DevTools opens from the dev menu, or by pressing `j` in the terminal running Metro. It connects to the JS engine on the device, so you debug what users run. Panels can differ between RN versions; check the docs for yours.
- Set breakpoints on any line in the Sources panel. A conditional breakpoint such as `item.price === undefined` skips normal runs.
- `debugger;` is a hard breakpoint when a debugger is attached and a no-op otherwise. Let lint block it before merge.
- While paused, the whole JS thread stops: timers, network callbacks and JS-driven updates wait. The pause itself can hide a timing bug.
- The console keeps references, not snapshots. An expanded object shows its current state, so log `JSON.stringify(value)` for a point-in-time value.

### The old way
Legacy "Debug JS Remotely" ran your JS in Chrome's V8 on the computer, so a bug could vanish under the debugger because a different engine ran the code. It is deprecated and does not work in the New Architecture's bridgeless mode. Flipper left the project template in RN 0.74.

### React DevTools
The Components panel shows the current props, state and hooks of a component, so you can find where a bad value starts. The Profiler records commits; with the setting that records why each component rendered, it tells you which props or hooks changed.

### Red box and LogBox
In dev, an uncaught error shows a red box; logged warnings and errors appear in LogBox. In release there is no red box, but the exception is still thrown. Look for the first frame of your own code; top frames are often a library reporting bad input.

### Release-only bugs
- Reproduce on a release build on a real device, reading device logs.
- Symbolicate stacks with the source map of that exact build.
- List what differs from dev: `__DEV__` branches, minified names (never branch on `constructor.name`), config, stripped `console` calls.
- Log structured events: an event name, a request id shared with the backend, and errors normalised to `name`, `message` and `stack`. `JSON.stringify` on an `Error` gives `{}`.

### Shrinking the problem
Build a minimal reproduction in a fresh project with the same versions, and remove code by halves until the bug disappears. To find when it started, run `git bisect` between a good and a bad commit, or `git bisect run` with a script when a test can check it.

## Interview angle
- "A bug only happens in release. How do you debug it?" Reproduce on release, logs, source map, dev versus release differences, minimal repro.
- "Why did the bug disappear under the debugger?" A different engine (legacy remote debugging) or changed timing from pausing.

## Common pitfalls
- Reaching for remote Chrome debugging or Flipper on a modern project
- Expecting to attach the debugger to a release build
- Trusting an expanded console object as a snapshot
- Logging raw `Error` objects with `JSON.stringify`
- Branching on class or function names that the minifier renames
- Blaming the top stack frame instead of the first app frame

## Related
`maintain-crash-core`, `maintain-regression-core`, `workflow-git-agile-core`, `performance-js-thread-core`
