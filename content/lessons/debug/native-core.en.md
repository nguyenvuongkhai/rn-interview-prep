---
id: debug-native-core
topic: debug/native
kind: core
readMinutes: 6
---
## TL;DR
Bugs below JS are invisible to React Native DevTools and Metro. Read native logs with `adb logcat` or Console.app and the Xcode console, read a native crash from the root exception and the first app frame in the crashed thread, and step through native code by attaching Android Studio or Xcode. Reproduce release-only or device-only bugs with that exact build on that exact OS first.

## Under the hood
### Android logs and adb
- `adb logcat --pid=$(adb shell pidof -s com.shop.app)` keeps every line from your process: JS `console.*`, native logs and the `AndroidRuntime` crash stack. The PID changes on restart; `adb logcat -b crash` still holds the last crash.
- Tag and priority filters narrow by tag or level, not by app. Grepping for the package name misses most lines.
- `adb reverse tcp:8081 tcp:8081` lets a physical device reach Metro at `localhost:8081` while the adb connection lasts. `adb -s <serial>` picks one of several devices.
- `adb shell pm clear <package>` wipes app data. `adb install -r` keeps data; `adb install -g` grants runtime permissions and can hide permission bugs.

### iOS logs
`os_log` and `NSLog` go to the unified log, shown in the Xcode console when you run from Xcode. Otherwise open Console.app, pick the device, start streaming before you reproduce, and filter by process. Past crash logs are in Xcode's devices window or the analytics data in Settings.

### Reading a native crash
- Java/Kotlin: follow the `Caused by:` chain to the last block. Outer exceptions are usually framework wrappers. `... N more` means the frames match the enclosing trace; nothing is lost.
- Signals: `SIGSEGV` (`EXC_BAD_ACCESS` on iOS) is an invalid memory access. `SIGABRT` is code calling `abort()`; read the `Abort message:` first.
- iOS reports name the crashing thread in `Triggered by Thread`; Thread 0 often just idles in its run loop. A crash inside `objc_msgSend` usually means a message to a freed object.
- Start from the first frame of your own code in the crashed thread. Symbolication is covered in `maintain-crash-core`.

### Native debuggers
Open `android/` in Android Studio, set a breakpoint and attach to the running debug app; C++ needs the native or dual debugger type. On iOS, open the `.xcworkspace`, run or attach by name or PID, and use LLDB (`bt`, `po`). Android release builds are not debuggable. The JS debugger can run alongside, but a long main-thread pause freezes the UI.

### Release-only and device-only bugs
Install the real release build (for example `./gradlew installRelease`) and read logcat before guessing. R8 problems look like `ClassNotFoundException` or `NoSuchMethodError` in code reached by reflection or JNI; decode with `retrace`, then add a narrow keep rule. A permission declared only in `src/debug` is missing from release; check the merged manifest. For one OS version, reproduce there and look for APIs called without `@available`.

## Interview angle
- "Debug works, release crashes on launch." Install release, `adb logcat -b crash`, retrace, confirm, narrow fix.
- "Crash only on one iOS version, nothing in Crashlytics." Pull the device crash log, symbolicate, reproduce on that OS.

## Common pitfalls
- Looking for native logs in Metro or React Native DevTools
- Filtering logcat by tag or package name instead of PID
- Stopping at the outermost exception instead of the last `Caused by:`
- Reading Thread 0 instead of the crashed thread
- Confusing `adb forward` with `adb reverse`
- Testing with `adb install -g` and never seeing the permission flow
- Blaming R8 for every release-only bug

## Related
`maintain-crash-core`, `native-build-core`, `native-modules-android-core`, `native-modules-ios-core`, `release-android-core`
