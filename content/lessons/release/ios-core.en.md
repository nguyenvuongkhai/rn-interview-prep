---
id: release-ios-core
topic: release/ios
kind: core
readMinutes: 6
---
## TL;DR
Shipping on iOS involves three separate systems: signing (who built the app, and for which app), App Store Connect (versions, builds, TestFlight) and App Review (the guidelines). Most release-day surprises come from mixing them up. Requirements change yearly, so check Apple's current docs before each release.

## Under the hood
### Signing
A distribution certificate and its private key prove who signed a build. The key lives in the keychain of the machine that created the certificate, or in an exported `.p12`. A provisioning profile ties an App ID (the bundle id) to certificates and entitlements. Development and ad hoc profiles also list devices; App Store profiles do not. Capabilities such as Push Notifications or Sign in with Apple must be enabled on the App ID, or the profile will not carry the entitlement.

An expired or revoked certificate never breaks the live app, because Apple re-signs App Store releases; it only stops you signing new builds. Distribution builds also talk to production APNs, so a server that sends TestFlight pushes to the sandbox gets `BadDeviceToken`.

### Versions and builds
`CFBundleShortVersionString` (`MARKETING_VERSION`) is the version users see. `CFBundleVersion` (`CURRENT_PROJECT_VERSION`) is the build number, and every upload for a version needs a new one. After upload, App Store Connect processes the build before you can use it. Once a version is approved it is fixed, and the next fix is a new version.

### TestFlight
Internal testers are members of your App Store Connect team and get a build once it is processed. External testers can be anyone, invited by email or public link, and the first build of a version they receive goes through Beta App Review. At the time of writing (2025) the limits were 100 internal and 10,000 external testers, and builds expire after 90 days.

### Review and release
Common rejections: missing or vague purpose strings such as `NSCameraUsageDescription`, background modes the app does not need (guideline 2.5.4), and third-party logins without an equivalent privacy-focused option such as Sign in with Apple (guideline 4.8). Since May 2024, a build is rejected when a required-reason API, for example `UserDefaults` or file timestamps, has no declared reason in a privacy manifest. SDKs ship their own `PrivacyInfo.xcprivacy`, and Xcode can generate a privacy report from an archive.

After approval, a phased release spreads automatic updates over seven days. Pausing stops automatic updates only: new installs and manual updates still get the new version, and nothing moves users back. For a critical fix you can request an expedited review, which Apple may decline.

## Interview angle
- "What do you bump when App Store Connect refuses an upload as a duplicate?" The build number, not the version.
- "Can you roll back an iOS release?" No. Pause the phased release, limit the damage with a remote flag or a compatible OTA update, and ship a new version.
- "How do you protect a launch date from review?" Submit early, choose manual release after approval, put a demo account in the review notes, and check new SDKs for privacy manifests.

## Common pitfalls
- Hiding Sign in with Apple behind a remote flag that is off during review
- Declaring a background mode, such as `location`, that the app never uses in the background
- Choosing the APNs environment from the server's environment instead of the build's signing
- Assuming a missing API declaration comes from your own code, when an SDK usually triggers it
- Keeping the only signing identity on one developer's laptop

## Related
`release-android-core`, `release-ota-ci-core`, `native/build`
