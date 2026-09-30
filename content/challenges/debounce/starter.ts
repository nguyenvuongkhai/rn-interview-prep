export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): ((...args: A) => void) & { cancel: () => void } {
  // TODO: call fn once `wait` ms have passed since the last call
  throw new Error('Not implemented');
}
