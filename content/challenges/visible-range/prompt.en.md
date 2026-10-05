## Task
Write `createLayout(heights)`. `heights[i]` is the measured height of row `i`, always positive. It returns:

- `totalHeight`: the height of the whole list
- `offsetOf(index)`: the y position where row `index` starts
- `range(offset, viewport, windowSize)`: the rows to render, as `{ first, last }` (both inclusive), or `null` when no row is in range

`range` follows the `windowSize` prop of `FlatList`: the render region is `windowSize` viewports tall, centred on the visible one. With `windowSize` 1 you render only what is on screen; with 21 (the default) you render 10 viewports above and 10 below.

## Why interviewers ask
A feed with 50,000 rows of different heights stutters because the list renders too much, or shows blank space because it renders too little. Interviewers want to know what `windowSize`, `getItemLayout` and cell measurement actually do. `range` runs on every scroll event, so it must not walk the whole list each time.

## Example
```ts
const layout = createLayout([100, 100, 100, 100, 100]);
layout.offsetOf(3);                  // 300
layout.range(120, 150, 1);           // { first: 1, last: 2 }
```

## Rules
- A row is in range when it overlaps the region. A row that only touches the region edge is not.
- `offset` can be negative (iOS bounce) or past the end. Clamp the region to `[0, totalHeight]`.
- An empty list has `totalHeight` 0, and `range` returns `null`.
- Do the linear work once in `createLayout`. Each `range` call must be faster than a scan over every row.
