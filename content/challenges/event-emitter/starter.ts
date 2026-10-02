export type Listener<T> = (payload: T) => void;

export function createEmitter<Events extends Record<string, unknown>>(): {
  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void;
  once<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
  listenerCount<K extends keyof Events>(event: K): number;
} {
  // TODO: keep listeners per event, and make emit safe when listeners change or throw
  throw new Error('Not implemented');
}
