---
id: maintain-regression-core
topic: maintain/regression
kind: core
readMinutes: 6
---
## TL;DR
A performance regression is a bug that no test fails. You catch it by measuring the right moments on release builds and real devices, and by alerting per version. You contain it with kill switches and the right rollback path: OTA for JS-only changes, a new binary for everything else. You stop it recurring with budgets in CI and a blameless post-mortem.

## Under the hood
### Measure what users feel
Debug builds load JS from Metro, skip bytecode precompilation and run dev-only checks, so their timings mean little. Measure cold start on release builds, from process start, on mid-range and low-end devices, over many runs, and compare medians and p90s. In production, use real-user metrics (performance traces, app start, slow and frozen frames) split by version and device tier. A trace is only as good as its end point: end it when the user sees real content, not when a skeleton lays out.

### Where startup time goes
Before the first frame: process start, native SDK init in `Application` or `AppDelegate`, loading the bundle, then every module that runs at import time. Typical regressions are a new SDK initialised synchronously, a library imported whole, and work done at module load. Keep `inlineRequires` on (the default in the current template), defer anything the first screen does not need, and diff the startup path between releases.

```ts
// Defer work the first frame does not need
let index: SearchIndex | null = null;
export function getSearchIndex(): SearchIndex {
  index ??= buildSearchIndex(readCatalogSync());
  return index;
}
```

### Bundle size and frame rate
Plain Metro does not tree-shake by default, so one import can add a megabyte. Build the release bundle with `--sourcemap-output`, inspect it with `source-map-explorer`, and fail CI above a threshold. For jank, Perf Monitor shows a UI and a JS frame rate; a healthy UI with a falling JS rate means the JS thread is the bottleneck. After a dependency bump, profile it, then confirm on a release build.

### Memory over long sessions
"Worse over time, fixed by a restart" means accumulation: listeners and timers without cleanup, screens pushed onto a stack forever, append-only arrays in a store, unbounded caches. Compare Hermes heap snapshots taken minutes apart, and check native memory, since images do not live in the JS heap.

### Containment and rollback
A kill switch is a runtime flag from remote config, with a cached value, a safe default and a tested old path. OTA updates roll back JS-only changes by republishing the last good bundle to the same channel and runtime version; users get it on their next update check, usually their next launch. Binaries cannot be rolled back: halt the rollout and ship a higher version code. Microsoft retired App Center, including CodePush, on 31 March 2025.

### After the incident
Run a blameless post-mortem: a timestamped timeline, impact in numbers, root cause and contributing factors, and action items with owners.

## Interview angle
- "p90 cold start got 60% worse. What do you do?" Confirm with real-user metrics, reproduce on a release build, diff the startup path, profile the right layer, add a budget.
- "How do you roll back a bad release?" Flag first, OTA if JS-only and runtime-compatible, otherwise a new binary.

## Common pitfalls
- Measuring performance on debug builds
- Ending a trace at the skeleton instead of real content
- Heavy synchronous work at module load
- Listeners and timers without cleanup
- Build-time flags used as kill switches
- Publishing an OTA rollback to every runtime version

## Related
`maintain-crash-core`, `maintain-upgrade-core`, `performance/js-thread`, `release/ota-ci`
