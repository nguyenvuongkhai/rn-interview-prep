export type Range = { first: number; last: number };

export function createLayout(heights: number[]) {
  const n = heights.length;
  // starts[i] is where row i begins; starts[n] is the total height
  const starts = new Array<number>(n + 1);
  starts[0] = 0;
  for (let i = 0; i < n; i++) starts[i + 1] = starts[i] + heights[i];
  const totalHeight = starts[n];

  /** The smallest k in [0, n] with starts[k] > value (strict) or >= value, or n + 1 if none. */
  const search = (value: number, strict: boolean): number => {
    let lo = 0;
    let hi = n + 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strict ? starts[mid] > value : starts[mid] >= value) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };

  return {
    totalHeight,
    offsetOf(index: number): number {
      return starts[index];
    },
    range(offset: number, viewport: number, windowSize: number): Range | null {
      const ext = (viewport * (windowSize - 1)) / 2;
      const top = Math.max(0, offset - ext);
      const bottom = Math.min(totalHeight, offset + viewport + ext);
      if (n === 0 || bottom <= top) return null;
      // first row whose end (starts[i + 1]) is past top; last row whose start is before bottom
      return { first: search(top, true) - 1, last: search(bottom, false) - 1 };
    },
  };
}
