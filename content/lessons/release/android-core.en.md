---
id: release-android-core
topic: release/android
kind: core
readMinutes: 6
---
## TL;DR
Google Play separates the key you upload with from the key users see, builds device APKs from your AAB, and lets you release by track and by percentage. Nothing on Play rolls a user back: you halt and ship a higher `versionCode`. Policies change yearly, so check the Policy status page in Play Console before each release.

## Under the hood
### Signing
With Play App Signing, Google keeps the app signing key and you sign each upload with an upload key. Play verifies the upload, then signs the APKs it generates with the app signing key, so users always see the same signature. If the upload key is lost, the account owner can request a reset from the App integrity page, though it does not take effect instantly. If the signing key of an app not enrolled in Play App Signing is lost, that app can never be updated. Services such as Google Sign-In need the app signing key's fingerprint, not the upload key's.

### Bundles and versions
An AAB is a publishing format, not an installable file. Play splits it by ABI, screen density and language into per-device APKs. To test it locally use `bundletool`, or ship to internal testing. `versionCode` is an integer that must be new for every upload and higher for every update; `versionName` is only a display string. The RN template's `release` build type uses the debug signing config until you change it.

### Tracks and rollouts
Promote one release through internal, closed and open testing to production instead of rebuilding. Production can use a staged rollout to a percentage of users. Halting it stops new users getting the release but leaves it on devices that already updated. New personal developer accounts (created after November 2023) must also run a closed test before publishing to production; check the current tester count and duration in Play Console.

### Policy
Play sets a yearly `targetSdkVersion` deadline, usually at the end of August; for example, from 31 August 2025 new apps and updates had to target API 35 (Android 15), and the level rises again each year, so read the current one in Play Console. Each bump changes runtime behaviour, so test it like a feature. The Data safety form on the App content page must cover what every SDK collects. Sensitive permissions such as `READ_MEDIA_IMAGES` or background location need a core-feature justification; otherwise use the system photo picker or drop them.

### Release-only failures
Release builds run R8 when `minifyEnabled` is on, ship Hermes bytecode, set `__DEV__` to `false`, and block the cleartext HTTP that debug allows for Metro. R8 renames or removes anything reached only by reflection, such as Gson models, so keep rules must include members (`{ *; }`), and the mapping file decodes stack traces. Hermes traces need source maps too.

## Interview angle
- "Upload key or app signing key: which one did you lose?" One costs an afternoon, the other a new app.
- "How do you roll back on Play?" You do not. Halt, mitigate, then ship a higher `versionCode`.
- "Works in debug, crashes in release. Where do you look?" `adb logcat` on the release build, R8 rules and mapping, `__DEV__` branches, cleartext traffic.

## Common pitfalls
- Shipping with the template's debug signing config in the `release` build type
- Keep rules that keep a class but not its fields
- Declaring broad photo access for a one-off image pick
- A Data safety form that ignores what SDKs collect
- Raising targetSdk on release day without testing the behaviour changes

## Related
`release-ios-core`, `release-ota-ci-core`, `native/build`
