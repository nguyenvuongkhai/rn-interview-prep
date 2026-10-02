---
id: maintain-upgrade-core
topic: maintain/upgrade
kind: core
readMinutes: 6
---
## TL;DR
Upgrading React Native is a change to your native project, not a version bump in `package.json`. The template, every native library, the build toolchain and your own old workarounds all move at once. Upgrade in small hops, keep every hop buildable on both platforms, and ship it like any risky release.

## Under the hood
### What actually changes
The `react-native` package ships JS, native code and a project template. Your `ios/` and `android/` folders were generated from an older template and now belong to you, so nothing updates them automatically. React Native Upgrade Helper shows the template diff between any two versions: `package.json`, `Podfile`, `build.gradle`, `gradle.properties`, AppDelegate, MainApplication, and the Metro and Babel config. You apply each hunk by hand and must understand it, because your project has drifted from the template.

### Libraries and the New Architecture
From RN 0.76 the New Architecture is on by default. From 0.74 the interop layer is enabled automatically, so many legacy modules and views keep working, but not all. Check React Native Directory for New Architecture support and test every screen that uses a legacy library. Up to 0.81 you can opt out temporarily with `newArchEnabled=false` and `RCT_NEW_ARCH_ENABLED=0`; per the 0.82 release notes, the legacy architecture cannot be turned back on from that version.

RN 0.78 brings React 19 (0.76 and 0.77 ship React 18.3), which conflicts with libraries that declare a `react@^18` peer. There must still be exactly one React.

### The toolchain
Upgrades raise minimum versions: Xcode, the iOS deployment target (15.1 from RN 0.76), the JDK (17 from 0.73), and the Android Gradle Plugin (8 from 0.73, which requires a `namespace` in every module's `build.gradle`). Many "it no longer builds" errors are toolchain problems, not code. After a toolchain change, clean Pods, DerivedData and the Gradle caches before you debug anything else.

### Your own leftovers
Upgrade Helper cannot see what is not in the template: `resolutions` and `overrides`, files in `patches/`, custom Metro and Babel settings. Audit each one. Old pins on packages like `@react-native/codegen` silently break builds, and a patch is tied to one exact library version. When you carry custom config forward, extend the defaults:

```ts
// metro.config.js (excerpt)
const defaults = getDefaultConfig(__dirname);
const config = {
  resolver: { sourceExts: [...defaults.resolver.sourceExts, 'svg'] },
};
module.exports = mergeConfig(defaults, config);
```

`mergeConfig` merges objects but replaces arrays, so `sourceExts: ['svg']` would remove `.ts` and `.js`.

### Shipping it
Test release builds on real devices, because Hermes bytecode and R8 only exist there. Ship internally, then roll out in stages with stop thresholds agreed in advance. Bump the OTA runtime version, since native code changed. A binary cannot be rolled back; a bad upgrade is fixed with a higher version code.

## Interview angle
- "How would you upgrade an app five versions behind?" Inventory native dependencies, upgrade in hops, isolate the New Architecture step, then roll out in stages.
- "A library does not support the New Architecture. What are your options?" Rely on interop after testing, upgrade, patch, replace, or opt out temporarily where the version allows.

## Common pitfalls
- Skipping or blindly pasting template hunks, such as a hardcoded `platform :ios` version
- Replacing Metro's default arrays instead of extending them
- Leaving old `resolutions` or `overrides` pins in place
- Pinning a patched library with a `^` range
- Installing a second React to satisfy a peer dependency
- Forgetting to bump the OTA runtime version
- Testing only debug builds

## Related
`maintain-crash-core`, `maintain-regression-core`, `architecture/new-arch`, `release/ota-ci`
