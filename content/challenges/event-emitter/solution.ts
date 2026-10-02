export type Listener<T> = (payload: T) => void;

type Entry<T> = { fn: Listener<T>; once: boolean; active: boolean };

export function createEmitter<Events extends Record<string, unknown>>() {
  const registry: { [K in keyof Events]?: Entry<Events[K]>[] } = {};

  const remove = <K extends keyof Events>(event: K, entry: Entry<Events[K]>) => {
    if (!entry.active) return;
    entry.active = false;
    const list = registry[event];
    if (list) registry[event] = list.filter((e) => e !== entry);
  };

  const add = <K extends keyof Events>(event: K, fn: Listener<Events[K]>, once: boolean) => {
    const entry: Entry<Events[K]> = { fn, once, active: true };
    registry[event] = [...(registry[event] ?? []), entry];
    return () => remove(event, entry);
  };

  return {
    on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
      return add(event, fn, false);
    },
    once<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
      return add(event, fn, true);
    },
    emit<K extends keyof Events>(event: K, payload: Events[K]): void {
      // a snapshot: listeners added during this emit wait for the next one
      const snapshot = registry[event] ?? [];
      let failed = false;
      let firstError: unknown;
      for (const entry of snapshot) {
        // removed earlier in this emit, by another listener or by itself
        if (!entry.active) continue;
        if (entry.once) remove(event, entry);
        try {
          entry.fn(payload);
        } catch (e) {
          if (!failed) {
            failed = true;
            firstError = e;
          }
        }
      }
      if (failed) throw firstError;
    },
    listenerCount<K extends keyof Events>(event: K): number {
      return registry[event]?.length ?? 0;
    },
  };
}
