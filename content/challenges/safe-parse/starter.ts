export type Issue = { path: (string | number)[]; message: string };
export type Result<T> = { success: true; data: T } | { success: false; issues: Issue[] };

export interface Schema<T> {
  safeParse(value: unknown): Result<T>;
  optional(): Schema<T | undefined>;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;
type Shape = Record<string, Schema<unknown>>;

export const s = {
  string(): Schema<string> {
    // TODO: build each schema, and let array and object collect issues from their children
    throw new Error('Not implemented');
  },
  number(): Schema<number> {
    throw new Error('Not implemented');
  },
  boolean(): Schema<boolean> {
    throw new Error('Not implemented');
  },
  literal<V extends string | number | boolean>(value: V): Schema<V> {
    throw new Error('Not implemented');
  },
  array<T>(item: Schema<T>): Schema<T[]> {
    throw new Error('Not implemented');
  },
  object<S extends Shape>(shape: S): Schema<{ [K in keyof S]: Infer<S[K]> }> {
    throw new Error('Not implemented');
  },
};
