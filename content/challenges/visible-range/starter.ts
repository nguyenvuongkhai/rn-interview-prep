export type Range = { first: number; last: number };

export function createLayout(heights: number[]): {
  totalHeight: number;
  offsetOf(index: number): number;
  range(offset: number, viewport: number, windowSize: number): Range | null;
} {
  // TODO: precompute row positions once, then answer range queries without a full scan
  throw new Error('Not implemented');
}
