---
id: performance-lists-core
topic: performance/lists
kind: core
readMinutes: 6
---
## TL;DR
FlatList is fast because it renders less, not because it renders differently. It keeps a window of rows mounted around the viewport and unmounts the rest. Most list problems come from breaking that window, giving it wrong measurements, or making each row too expensive to fill it in time.

## Under the hood
### Windowing
FlatList is built on `VirtualizedList`. `windowSize` is measured in visible lengths of the list: the default of 21 means the visible area plus up to 10 screens above and 10 below. Rows outside that area are unmounted. `initialNumToRender` (default 10) sets the first pass, and those rows are never unmounted by windowing. New rows arrive in batches of `maxToRenderPerBatch` (default 10), with `updateCellsBatchingPeriod` as the pause between batches.

Scrolling is native, but rendering rows happens on the JS thread. When a fling outruns the JS thread, you see blank areas. A larger window or larger batches hide blanks at the cost of memory and responsiveness. Cheaper rows fix the cause.

### Measurements
Without help, FlatList learns each row's position from `onLayout` after it renders. If every row has a known size, `getItemLayout` returns `{ length, offset, index }` directly, so the window is computed without measuring and `scrollToIndex` can reach rows that were never rendered. The numbers must match reality, separators included.

```ts
const getItemLayout = (_: unknown, index: number) => ({
  length: ROW_HEIGHT,
  offset: (ROW_HEIGHT + SEPARATOR_HEIGHT) * index,
  index,
});
```

### Keys and extraData
`keyExtractor` should return a stable id from the data. Index keys stay unique, so React never warns, but after an insert every instance shows a different item and its local state stays behind. `extraData` tells FlatList to re-render rows when something outside `data` that `renderItem` reads changes, such as a selected id.

### Pagination
`onEndReachedThreshold` is also in visible lengths: 0.5 means half a screen from the end. `onEndReached` can fire on mount when the first page is short, and again after each content change, so guard it with a ref and a `hasMore` check.

### FlashList
FlashList recycles cells: a row that leaves the screen is handed a new item instead of being unmounted. That is faster, but local state travels with the cell, so lift it to the parent by id or reset it when the item changes. FlashList v2 needs the New Architecture and no longer asks for `estimatedItemSize`.

### Measuring
Judge performance only on a release build. Dev builds run extra checks and give misleading numbers. Use the perf monitor to tell JS FPS from UI FPS, the React DevTools Profiler to see which rows render and why, and Flashlight on Android for a repeatable score.

## Interview angle
- "Why is a `ScrollView` with `map` slow for 1,000 items?" It mounts every row up front; FlatList mounts a window.
- "How do you fix blank areas on fast scrolls?" Make rows cheaper first, then tune `windowSize` and `maxToRenderPerBatch` and explain the memory and responsiveness trade-off.
- "When would you choose FlashList?" When measurements show FlatList is the bottleneck on long lists, and you have checked rows for local state.

## Common pitfalls
- Nesting a FlatList inside a `ScrollView` of the same orientation, which renders every row; use `ListHeaderComponent` instead
- Index keys on a list that inserts or reorders items
- A `getItemLayout` that ignores separators or headers, so `scrollToIndex` drifts
- Loading the same page twice because `onEndReached` is unguarded
- Full-resolution images in small rows, which exhausts memory on low-end Android
- Turning on `removeClippedSubviews` without testing, since the docs warn it can cause missing content

## Related
`render-memo-core`, `performance/js-thread`, `visible-range`
