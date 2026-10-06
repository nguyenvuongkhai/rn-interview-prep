---
id: testing-e2e-core
topic: testing/e2e
kind: core
readMinutes: 5
---
## TL;DR
An E2E test drives a real build on a simulator or emulator the way a user does. It is the only layer that proves screens, navigation, native modules and the backend work together, and also the slowest and flakiest. Keep it for a handful of critical journeys, push edge cases down to unit and component tests, and treat each flaky test as a bug with a cause: timing, animations, network or shared data.

## Under the hood
### Detox: gray-box
Detox runs your tests in Jest on the host and talks to a Detox client inside the app process. From there it knows when the app is busy: pending requests, animations, timers, JS thread work. It waits for idle before each action and assertion, so most steps need no explicit wait. The flip side: anything that never goes idle, such as an `Animated.loop`, a polling `setInterval` or a request that never completes, hangs the test until timeout. Stop the loop in E2E builds, exclude the URL with `device.setURLBlacklist`, or turn synchronisation off for that step and use `waitFor(...).toBeVisible().withTimeout(...)`.

### Maestro: black-box
Maestro flows are YAML files built from commands such as `launchApp`, `tapOn`, `inputText` and `assertVisible`. The Maestro CLI drives the app from outside through the platform's UI automation, with nothing added to your build. It cannot tell whether the app is busy, so it tolerates delay: each command retries until the element appears or a timeout passes. Flows are quick to write and easy for QA to read, but you get no access to app internals.

### The pyramid
- Unit tests with Jest: pure logic such as validation, reducers and formatters. Fast, many, every edge case.
- Component tests with React Native Testing Library: one screen with native modules and network mocked. Most behaviour is tested here.
- E2E: a few journeys that earn money or lose users, such as sign-up, login, checkout, or a deep link opening the right screen.

Select elements by `testID`, not visible text, so copy changes and translations do not break tests.

### Flakiness
- Timing: a fixed sleep is too short on a slow CI machine and wasted on a fast one. Wait on a condition.
- Animations keep Detox busy or move an element while it is tapped.
- Network: shared staging data changes under you. Use a seeded backend or a mock server.
- Shared data: tests sharing an account break each other in parallel. Create data per test and reset state at launch, for example `device.launchApp({ newInstance: true, delete: true })` in Detox or `launchApp` with `clearState: true` in Maestro.

### On CI
Android emulators run on Linux runners with hardware acceleration; iOS simulators need costlier macOS runners. Build the test binary once and share it across shards. Run a smoke set on each PR and the full suite nightly or before a release. Keep videos, screenshots and logs of failed tests as artifacts.

## Interview angle
- "Our E2E suite is flaky. What do you do?" Measure failure rate per test, quarantine the worst, fix each cause, and track retries instead of hiding them.
- "Detox or Maestro?" Compare synchronisation, who writes the tests, the language, and the cost of a test build.
- "What should not be an E2E test?" Logic edge cases, visual variants, and native screens you do not own, such as a system payment sheet.

## Common pitfalls
- Fixed sleeps instead of waiting on an element
- Forgetting `await` on a Detox `expect`, so a failure is never reported
- Assuming a clean app between runs without clearing state
- One test account shared across parallel workers
- Running against shared staging data
- Retrying until green and never fixing the cause

## Related
`testing/unit`, `testing/components`, `release/ota-ci`, `maintain/regression`
