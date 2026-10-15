---
id: arch-new-arch-bridge-vs-jsi
topic: architecture/new-arch
kind: core
readMinutes: 5
---
## TL;DR
The old bridge sent **asynchronous, batched JSON messages** between JS and native. The New Architecture replaces it with **JSI**, so JavaScript calls native code directly. It has been the default since React Native 0.76.

## Under the hood
- **Old bridge:** every call was serialized to JSON, queued and sent asynchronously. Under heavy traffic (fast scrolling, animations) it became a bottleneck, and nothing could run synchronously.
- **JSI (JavaScript Interface):** a C++ layer that lets JavaScript hold references to native objects and call them directly, with no JSON.
- **TurboModules:** native modules loaded lazily on first use (faster startup). **Codegen** generates type-safe native code from TypeScript specs.
- **Fabric:** the new renderer. Synchronous layout (no flicker on measured layouts) and support for React's concurrent features like `useTransition` and Suspense.

## Interview angle
- "Is upgrading worth it for the client?" Yes: faster startup, smoother UI, fewer JS/native type bugs, and staying current. Recent versions run only on it, and libraries like Reanimated 4 require it.
- "What's the cost?" Migration: audit third-party libraries, replace unsupported ones, migrate custom native modules, upgrade in steps, test both platforms.
- "What does JSI let JS hold?" References to native (C++) objects, called directly.

## Common pitfalls
- Saying the New Architecture removes *every* performance problem. Your own heavy JavaScript still blocks the JS thread.
- Calling Hermes part of the New Architecture. Hermes is the JS engine and works with both.
- Answering in absolutes ("no more bottlenecks at all"). Say "removes the bridge bottleneck".

## Related
`architecture/threading`
