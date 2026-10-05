export type RunResult<R> = { status: 'done'; value: R } | { status: 'cancelled' };

type Entry<R> = { controller: AbortController; resolve: (result: RunResult<R>) => void };

export function takeLatest<A, R>(worker: (arg: A, signal: AbortSignal) => Promise<R>) {
  let current: Entry<R> | null = null;

  const cancel = (): void => {
    if (!current) return;
    const { controller, resolve } = current;
    current = null;
    controller.abort();
    resolve({ status: 'cancelled' });
  };

  return {
    run(arg: A): Promise<RunResult<R>> {
      cancel();
      return new Promise<RunResult<R>>((resolve, reject) => {
        const entry: Entry<R> = { controller: new AbortController(), resolve };
        current = entry;
        let started: Promise<R>;
        try {
          started = worker(arg, entry.controller.signal);
        } catch (e) {
          started = Promise.reject(e);
        }
        started.then(
          (value) => {
            // superseded or cancelled: the late value is ignored
            if (current !== entry) return;
            current = null;
            resolve({ status: 'done', value });
          },
          (error: unknown) => {
            if (current !== entry) return;
            current = null;
            reject(error);
          },
        );
      });
    },
    cancel,
  };
}
