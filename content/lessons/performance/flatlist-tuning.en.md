---
id: perf-lists-flatlist-tuning
topic: performance/lists
kind: hard-issue
readMinutes: 6
---
## TL;DR
`FlatList` already virtualizes. Lag comes from **expensive rows, unnecessary re-renders, or too much work at once**. Blank areas mean rows can't render as fast as the user scrolls.

## Under the hood
1. **Measure first:** test in a **release build** (dev mode is misleading), use the Profiler to find re-renders, and check whether the JS or UI thread drops frames.
2. **Make rows cheap and stable:** `React.memo` rows, stable `renderItem` and handlers, ID-based `keyExtractor`, no heavy work inside rows, and **properly sized, cached images** (a very common cause).
3. **Tune the list:** `getItemLayout` for fixed heights, `initialNumToRender`, `maxToRenderPerBatch`, `windowSize` (memory vs blank areas).
4. **Paginate:** `onEndReached` and `onEndReachedThreshold`, with a guard against double loading.
5. **Consider FlashList:** it recycles row views instead of recreating them; v2 is built for the New Architecture.

## Interview angle
- "Where do you start?" Reproduce in a release build and profile. Never tune props blindly.
- "Why do blank areas appear?" Rendering can't keep up with scrolling. Cheaper rows or a larger `windowSize` help, at a memory cost.
- "When FlashList?" When rows are still expensive after memoizing, or the list is very long.

## Common pitfalls
- Full-resolution images in small thumbnails
- Inline `renderItem` and handlers that defeat `React.memo`
- Treating `removeClippedSubviews` as a safe default; it can cause missing content on iOS in some layouts, so test first
- Loading thousands of items instead of paginating

## Related
`render/memo`, `architecture/threading`
