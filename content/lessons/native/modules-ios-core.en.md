---
id: native-modules-ios-core
topic: native/modules-ios
kind: core
readMinutes: 6
---
## TL;DR
An iOS native module is an Objective-C, Objective-C++ or Swift class that JavaScript calls asynchronously. Legacy modules register themselves with macros; TurboModules start from a TypeScript spec that Codegen turns into native interfaces, and they are the default from RN 0.76. Either way, three things decide correctness: the thread each piece runs on, every promise settling exactly once, and nothing keeping the module alive afterwards.

## Under the hood
### Legacy modules
```objc
@implementation CalendarModule
RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(createEvent:(NSString *)title
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve([EventStore.shared add:title]);
}
@end
```
`RCT_EXPORT_MODULE()` exposes the class under its name. Each exported method becomes an async JS function. A callback (`RCTResponseSenderBlock`) or a promise pair must be invoked once, on every path.

### Threads
- Async methods run on the module's `methodQueue`. By default each legacy module gets its own serial queue, so calls are ordered and off the main thread.
- UIKit work must hop to the main queue with `dispatch_async(dispatch_get_main_queue(), ...)`, or the module returns `dispatch_get_main_queue()` from `methodQueue` when it only does UI.
- `+ requiresMainQueueSetup` returning `YES` makes initialisation, and the legacy `constantsToExport`, run on the main thread. It does not move method calls. Keep it small: it can run during launch.
- `RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD` runs on the JS thread and blocks it.

### TurboModules and Codegen
The spec is a file such as `NativeCalendar.ts` inside the `jsSrcsDir` named in package.json's `codegenConfig`. It exports `TurboModuleRegistry.getEnforcing<Spec>('Calendar')`. On iOS, Codegen runs during `pod install`, and the `ReactCodegen` pod's `Generate Specs` build phase reruns it when a spec changes. It generates an Obj-C++ protocol plus a C++ JSI class. Your `.mm` class conforms to the protocol and returns that JSI class from `getTurboModule:`. Values are converted by generated code, so the spec is the contract. TurboModules load lazily on first use. An interop layer keeps many legacy modules working under the New Architecture.

### Swift
For a legacy module, an `@objc(Name)` Swift class is declared to React Native from an `.m` file with `RCT_EXTERN_MODULE` and `RCT_EXTERN_METHOD`. The Swift selector must match exactly: `func createEvent(_ title: String, ...)`, not `createEvent(title:)`. Because the generated spec uses C++ types, a Swift TurboModule needs a thin `.mm` class that conforms to the spec and forwards to Swift.

### Events
Subclass `RCTEventEmitter`, list names in `supportedEvents`, and call `sendEventWithName:body:` from any thread. JS listeners are counted: `startObserving` runs on the first, `stopObserving` after the last. Events sent with no listener are dropped, so send the current state when observing starts.

### Memory
Blocks given to NotificationCenter or SDKs capture `self` strongly. Remove observers in `stopObserving` or `invalidate`, and capture `__weak` self, or old instances survive every reload.

### Native views
A legacy `RCTViewManager` returns a new view from `view` and exports props with `RCT_EXPORT_VIEW_PROPERTY`. A Fabric component starts from `codegenNativeComponent`, and its iOS side is an `RCTViewComponentView` that applies props in `updateProps:oldProps:` and resets state in `prepareForRecycle`.

## Interview angle
- "Which thread does my method run on?" Its method queue, never the main thread unless you ask for it; synchronous methods run on the JS thread.
- "Legacy module or TurboModule?" New code gets a spec and Codegen; existing modules can move later, with the interop layer as a bridge.

## Common pitfalls
- Calling UIKit from an exported method without hopping to the main queue
- Expecting `requiresMainQueueSetup` to move method calls to the main thread
- A Swift label that changes the exported selector
- A code path that never resolves or rejects the promise
- Setting an observer token to `nil` instead of removing the observer

## Related
`native-modules-android-core`, `native-build-core`, `architecture/new-arch`
