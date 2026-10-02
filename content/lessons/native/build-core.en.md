---
id: native-build-core
topic: native/build
kind: core
readMinutes: 6
---
## TL;DR
A React Native app is two native projects plus a JS bundle. CocoaPods and Xcode build the iOS side, Gradle builds the Android side, autolinking wires in libraries from package.json, and Codegen generates the glue for TurboModules and Fabric components. Most build incidents come from one of four places: a step that did not rerun, versions that drifted from the template, configuration that differs between debug and release, or signing.

## Under the hood
### iOS: CocoaPods and Xcode
`pod install` reads the Podfile. `use_native_modules!` adds a pod for every autolinked library, `use_react_native!` adds React Native itself, and `react_native_post_install` must run inside the single `post_install` hook. On iOS, Codegen also runs during `pod install`, and again in the `ReactCodegen` pod's build phase. Rerun it whenever a native dependency or a spec changes, commit `Podfile.lock`, and pin CocoaPods with the template's `Gemfile` (`bundle exec pod install`).

```ruby
post_install do |installer|
  react_native_post_install(installer, config[:reactNativePath], :mac_catalyst_enabled => false)
  # your extra settings go here, in the same hook
end
```

In Xcode, a scheme picks a build configuration. Debug loads JS from Metro; Release embeds `main.jsbundle` through the `Bundle React Native code and images` phase. A custom configuration such as Staging must also be mapped in the Podfile (`project 'App', 'Staging' => :release`), or pods are built the wrong way.

### Android: Gradle
The root project pins the Gradle wrapper, the Android Gradle Plugin and Kotlin, plus `minSdkVersion`, `compileSdkVersion` and `targetSdkVersion`:

- `minSdkVersion`: the oldest Android that can install the app
- `compileSdkVersion`: the APIs you compile against
- `targetSdkVersion`: the behaviour changes the app opts into

Since AGP 8 (RN 0.73 and later) every module declares a `namespace` in its `build.gradle`. The `react { }` block configures the RN Gradle plugin: `debuggableVariants` lists variants that skip bundling, and from RN 0.75 `autolinkLibrariesWithApp()` handles autolinking. Codegen runs as part of the Gradle build. `newArchEnabled` and `hermesEnabled` live in `gradle.properties`.

### Autolinking
The CLI reads dependencies from package.json and each library's native config; `npx react-native config` shows the result. `react-native.config.js` can turn a dependency off per platform. Code inside the app is never autolinked.

### Debug versus release
Release builds minify (R8 when `minifyEnabled` is on), set `__DEV__` to `false`, embed the bundle, and often use different environment values and entitlements. Libraries that use reflection need keep rules. Run a release build on a real device before every release.

### Signing
Android: the template signs release with the debug keystore. Add a `release` signing config that reads the upload key from `gradle.properties`, keep the keystore out of git, and remember that Play App Signing re-signs with the app signing key. iOS: a certificate plus a provisioning profile whose app ID and entitlements match the target's capabilities.

### New Architecture
On by default from RN 0.76, with `newArchEnabled=false` (Android) or `RCT_NEW_ARCH_ENABLED=0` at `pod install` (iOS) as the opt-out. From RN 0.82 the New Architecture can no longer be turned off, and those opt-outs are ignored.

## Interview angle
- "The build broke after an upgrade. Where do you start?" The first real error, then a diff against the template with the Upgrade Helper.
- "It works in debug only. Why?" R8, `__DEV__`, the embedded bundle, environment config or signing.

## Common pitfalls
- Forgetting `pod install` after adding a native library
- Two `post_install` hooks in one Podfile
- Release still signed with `signingConfigs.debug`
- A release variant listed in `debuggableVariants`
- A library without `namespace` under AGP 8
- Mismatched Kotlin or `compileSdkVersion` after an upgrade

## Related
`native-modules-ios-core`, `native-modules-android-core`, `maintain/upgrade`, `release/android`
