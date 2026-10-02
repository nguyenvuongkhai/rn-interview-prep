---
id: maintain-crash-core
topic: maintain/crash
kind: core
readMinutes: 6
---
## TL;DR
An RN app fails in three layers: JS, native code, and the OS killing the process. Each layer needs its own symbols to be readable (source maps, dSYMs, R8 mappings), uploaded for every build and every OTA update. Crash tools group reports by the app frames in the stack, so poor symbolication means poor grouping. When a release spikes, stop the rollout first and investigate second.

## Under the hood
### Three kinds of failure
- JS exceptions. An uncaught exception reaches the `ErrorUtils` global handler. In a release build the default handler treats it as fatal and the app stops. Unhandled promise rejections do not crash; in release they vanish unless you report them. Error boundaries catch render errors only, not errors in event handlers or async code.
- Native crashes. A Java/Kotlin exception, an Objective-C or Swift exception, or a signal such as `SIGSEGV` in C++ code.
- OS terminations. Android reports an ANR when the main thread cannot handle input for about 5 seconds; the usual causes are I/O or heavy init in `Application.onCreate` and native work on the main thread. iOS kills apps through jetsam for memory and through the watchdog for a hung main thread, for example at launch (exception code `0x8badf00d`). An in-process crash reporter records nothing for a jetsam kill, so look in Xcode Organizer, MetricKit's `MXAppExitMetric` or device logs instead.

### Symbols
Hermes compiles JS to bytecode, so a release stack shows bytecode offsets such as `index.android.bundle:1:948213`. To read it you need the composed source map (Metro plus the Hermes compiler) of that exact build. Native iOS frames need the dSYM matching the binary's UUID. Android frames renamed by R8 need that build's `mapping.txt`. Have CI upload all three on every build, and upload a new source map with every OTA update, since each update is a new bundle. Upload maps before the release goes out: events are processed on arrival.

### Grouping
Sentry and Crashlytics build a fingerprint mostly from in-app frames, ignoring framework frames, and fall back to the error type and message without a usable stack. Unsymbolicated frames differ between builds, so one bug splits into many issues. A shared helper such as `handleError` at the top of every stack does the opposite and merges unrelated bugs. Custom fingerprints, such as Sentry's `scope.setFingerprint`, fix both.

### Metrics
Crash-free users is the share of users with no crash in the period; crash-free sessions is the share of sessions that did not end in a crash. Handled errors are non-fatal and do not count. A few users crashing on every launch hurts sessions more than users, so watch both, per version. Play Console's Android vitals also tracks user-perceived crash and ANR rates against bad behaviour thresholds; those thresholds change, so check the current docs.

## Interview angle
- "Crash-free sessions dropped after a release. What do you do?" Halt the rollout, filter by version, check symbolication, split by device and OS, mitigate, then run a post-mortem.
- "Users say the app closes, but there is no crash report." Think OS kill: jetsam or watchdog on iOS, the low memory killer on Android.

## Common pitfalls
- Uploading source maps for the binary but not for OTA updates
- Keeping only the latest R8 mapping
- Turning off mapping upload for release builds
- Blaming the top frame instead of the first app frame
- Doing disk I/O on the main thread during startup
- Unbounded caches that end in a memory kill with no report

## Related
`maintain-upgrade-core`, `maintain-regression-core`, `release/ota-ci`, `native/build`
