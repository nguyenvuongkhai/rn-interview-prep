---
id: architecture-new-arch-core
topic: architecture/new-arch
kind: core
readMinutes: 6
---
## TL;DR
The New Architecture replaces the old bridge with JSI, a C++ interface that lets JS call native objects directly. On top of it sit TurboModules (lazy, typed native modules) and Fabric (a C++ renderer with an immutable shadow tree). From RN 0.76 it is on by default together with Bridgeless mode, and an interop layer keeps many legacy libraries running. Sync calls are possible but block the JS thread.

## Under the hood
### The old bridge
Every call between JS and native was serialised to JSON, queued and sent across the bridge in batches. Everything was asynchronous, large payloads paid for serialisation, and modules registered through packages were usually set up when the bridge started, used or not.

### JSI
JSI (JavaScript Interface) is a C++ API between the JS engine and native code. Native code exposes host objects and host functions; JS holds references to them and calls them directly, with no message passing, and synchronously when a method is declared that way. JSI is engine-agnostic: Hermes is the default engine, but JavaScriptCore implements JSI too. Codegen is separate: it generates typed interfaces from specs at build time.

### TurboModules
A TurboModule is created the first time JS asks for it through `TurboModuleRegistry`, then reused. A method whose spec returns a Promise runs asynchronously; one with a plain return type runs synchronously on the JS thread and holds it until native returns. That suits small values already in memory, not disk reads, network or heavy work.

### Fabric
An update goes through three phases:
- Render: React runs your components and Fabric creates or clones C++ shadow nodes.
- Commit: Yoga calculates layout and the new tree is promoted.
- Mount: the trees are diffed and the mutations are applied to host views on the UI thread.

Render and commit usually run on the JS thread, since the shadow tree is immutable C++. Only mount has to be on the main thread. Because layout is computed synchronously, `measureInWindow` inside `useLayoutEffect` returns this commit's layout before the frame is painted, so measured positioning no longer flickers. Fabric also supports React's concurrent root, which is what makes transitions and automatic batching work in RN.

### Bridgeless and interop
With Bridgeless mode there is no bridge object; on Android the runtime is owned by `ReactHost` instead of `ReactInstanceManager`. JS still runs on its own thread. From RN 0.74 the interop layer is on automatically, so many legacy modules and view managers keep working, but code that grabs the bridge, calls internal APIs or relies on old layout timing can break. From 0.76 to 0.81 you can opt out temporarily with `newArchEnabled=false` in `gradle.properties` and `RCT_NEW_ARCH_ENABLED=0` for `pod install`; per the 0.82 release notes, from that version the legacy architecture can no longer be turned back on.

## Interview angle
- "What changed from the bridge, and why does it matter?" Walk through bridge, JSI, TurboModules and Fabric, then name the gains: startup, synchronous layout, concurrent React, build-time types.
- "JSI allows sync calls, so should we use them everywhere?" No: sync blocks the JS thread. Keep async as the default and measure any sync method on a low-end device.

## Common pitfalls
- Thinking JSI or the New Architecture requires Hermes
- Making disk or network reads synchronous and calling them from scroll handlers
- Measuring in `useEffect` instead of `useLayoutEffect` and getting a one-frame flicker
- Adding `newArchEnabled=false` while the template's `newArchEnabled=true` is still further down the file
- Assuming the interop layer covers every legacy library without testing each screen

## Related
`maintain-upgrade-core`, `native-modules-ios-core`, `native-modules-android-core`, `performance-js-thread-core`
