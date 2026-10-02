---
id: release-ota-ci-core
topic: release/ota-ci
kind: core
readMinutes: 6
---
## TL;DR
An OTA update replaces the JS bundle and its assets on a binary that is already installed. It cannot change native code or configuration, so every update must go only to binaries whose native side matches, and declaring that match is the job of the runtime version. CI makes builds and updates repeatable: the same secrets, signing and checks every time. Versioning ties it together: store versions for binaries, a runtime version for OTA compatibility, and a server-side minimum version for force updates.

## Under the hood
### What OTA can ship
JS, plus the images and fonts the bundle references. Not native modules, not RN upgrades, not Info.plist or AndroidManifest changes, not icons. Apple's developer agreement allows downloaded interpreted code that keeps the app's purpose and does not bypass review; Play's Device and Network Abuse policy exempts code run by an interpreter such as JavaScript.

### Runtime version and channels
With EAS Update, each build carries a channel and a `runtimeVersion`, and an update reaches only builds on that channel with exactly the same runtime version. The `appVersion` policy copies `version`, so it is only as safe as your habit of bumping it when native code changes. The `fingerprint` policy hashes the native project, so a native change produces a new runtime version by itself. CodePush expressed the same idea with a target binary version. Microsoft retired App Center, including hosted CodePush, on 31 March 2025; the concepts live on in self-hosted CodePush servers.

### Rollback
CodePush keeps a new bundle pending until the app calls `notifyAppReady()`, which `sync()` does for you; a restart before that reverts to the previous bundle. `expo-updates` has its own recovery for updates that fail at launch. Neither catches a crash on a screen opened later, so the real rollback is republishing the last good update.

### CI/CD
Fastlane or EAS Build turns a tag into signed builds. Keep signing material out of the repo: a base64 keystore in a secret, `match` read-only on CI, an App Store Connect API key instead of an Apple ID. Derive build numbers from the pipeline or from the store's latest build. Key caches on what they contain: the lockfile for the package manager cache, `Podfile.lock` for Pods, the Gradle files for Gradle. Upload source maps and dSYMs for every build and every update.

### Force update
The server returns `latest` and `minSupported` per platform, and the app compares its native version against them as semver, part by part as numbers:

```ts
'2.9.5' < '2.10.0'; // false: strings compare character by character
```

A missing patch counts as 0, and a prerelease is lower than its release. Below `minSupported` the app shows a blocking screen; below `latest`, a prompt the user can dismiss. Raise `minSupported` only once the new version is available to everyone, and never block on a network error.

## Interview angle
- "Can this fix go out over the air?" Only if it touches no native code and targets the matching runtime version.
- "What stops an update reaching an incompatible binary?" The runtime version, and only if it changes whenever native code does.
- "How do you force an update?" Server-side thresholds, numeric semver comparison and a check that fails open.

## Common pitfalls
- A hard-coded `runtimeVersion` that never changes when native dependencies do
- Comparing version strings with `<`
- Exporting with a development profile because CI fetched the wrong `match` type
- Trusting log masking to protect secrets
- Raising `minSupported` during a staged rollout

## Related
`release-ios-core`, `release-android-core`, `maintain/upgrade`
