export type RunResult<R> = { status: 'done'; value: R } | { status: 'cancelled' };

export function takeLatest<A, R>(worker: (arg: A, signal: AbortSignal) => Promise<R>): {
  run(arg: A): Promise<RunResult<R>>;
  cancel(): void;
} {
  // TODO: cancel the previous run when a new one starts, and ignore late results
  throw new Error('Not implemented');
}
