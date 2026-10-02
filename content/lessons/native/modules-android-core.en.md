---
id: native-modules-android-core
topic: native/modules-android
kind: core
readMinutes: 6
---
## TL;DR
An Android native module is a Kotlin or Java class that JavaScript calls asynchronously. A legacy module extends `ReactContextBaseJavaModule` and is registered through a `ReactPackage`; a TurboModule extends a class that Codegen generates from a TypeScript spec, and is the default from RN 0.76. The hard parts are the same on both: run work on the right thread, never hold an Activity longer than it lives, and remember that newer `targetSdkVersion` values change how the OS treats your code.

## Under the hood
### Legacy modules and packages
```kotlin
class CalendarModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "CalendarModule"

  @ReactMethod
  fun createEvent(title: String, promise: Promise) {
    promise.resolve(EventStore.add(title))
  }
}
```
JS sees exactly the string from `getName()`. A `ReactPackage` returns the module from `createNativeModules`. Autolinking registers packages of libraries in package.json; a package that lives in the app is added by hand in `MainApplication.getPackages()`.

Argument types map from JS: `String`, `Boolean`, `Int` or `Double` for numbers, `ReadableMap`, `ReadableArray`, `Callback`, `Promise`. In Kotlin, a parameter that JS may send as `null` must be nullable (`String?`), or the call throws before the body runs.

### Threads
- Async `@ReactMethod`s run on the native modules thread, shared by every module. Long I/O there delays all other modules, so move it to your own executor or coroutine.
- View work goes to the UI thread with `UiThreadUtil.runOnUiThread { ... }`. Heavy work posted there causes ANRs.
- `@ReactMethod(isBlockingSynchronousMethod = true)` runs on the JS thread and blocks it.
- Resolving a promise or emitting an event is fine from any thread.

### Events
```kotlin
reactApplicationContext
  .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
  .emit("uploadProgress", Arguments.createMap().apply { putDouble("ratio", 0.5) })
```
`NativeEventEmitter` expects `addListener(eventName)` and `removeListeners(count)` on the module; use them to start and stop the native source. A `WritableMap` is consumed when it crosses to JS, so build a new one for every send.

### Activity, lifecycle and leaks
`reactApplicationContext` lives as long as the React instance. The Activity does not: read `reactApplicationContext.currentActivity` when you need it, and handle `null`. Results of `startActivityForResult` arrive through an `ActivityEventListener` registered with `addActivityEventListener`; host resume, pause and destroy arrive through a `LifecycleEventListener`. Remove both in `invalidate()`. Never store an Activity in a static field or a long-lived singleton.

### Permissions and target SDK
Declare permissions in the manifest and request dangerous ones at runtime, through `PermissionsAndroid` or `PermissionAwareActivity`. Behaviour changes tied to `targetSdkVersion` break old native code: an explicit mutability flag on every `PendingIntent` (target 31), runtime `POST_NOTIFICATIONS` (target 33), and an exported flag for `registerReceiver` (target 34).

### TurboModules
Write a `Native<Name>.ts` spec and a `codegenConfig` with `android.javaPackageName`. Gradle runs Codegen during the build and generates an abstract `Native<Name>Spec`; the module extends it, so type mismatches become compile errors. The package becomes a `BaseReactPackage` (`TurboReactPackage` in older versions).

## Interview angle
- "Where does a `@ReactMethod` run?" On the shared native modules thread, not the UI thread and not the JS thread.
- "How do you get an activity result?" `ActivityEventListener`, matching the request code, settling the promise once.
- "What did you check when raising `targetSdkVersion`?" The behaviour-changes page for each level, in your code and in every native library.

## Common pitfalls
- Forgetting to add an in-app package to `MainApplication`
- Non-null Kotlin parameters that JS can send as `null`
- Reusing a `WritableMap` after it was sent to JS
- Decoding or writing files inside `runOnUiThread`
- Keeping `currentActivity` in a field or companion object
- Missing `FLAG_IMMUTABLE` or `FLAG_MUTABLE` on a `PendingIntent`

## Related
`native-modules-ios-core`, `native-build-core`, `maintain/crash`
