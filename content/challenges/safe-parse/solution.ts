export type Issue = { path: (string | number)[]; message: string };
export type Result<T> = { success: true; data: T } | { success: false; issues: Issue[] };

export interface Schema<T> {
  safeParse(value: unknown): Result<T>;
  optional(): Schema<T | undefined>;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;
type Shape = Record<string, Schema<unknown>>;
type Path = (string | number)[];
type Check<T> = (value: unknown, path: Path, issues: Issue[]) => T;

// the internal check, kept off the public interface
const checks = new WeakMap<Schema<unknown>, Check<unknown>>();

function make<T>(check: Check<T>): Schema<T> {
  const schema: Schema<T> = {
    safeParse(value) {
      const issues: Issue[] = [];
      const data = check(value, [], issues);
      return issues.length === 0 ? { success: true, data } : { success: false, issues };
    },
    optional() {
      return make<T | undefined>((value, path, issues) => (value === undefined ? undefined : check(value, path, issues)));
    },
  };
  checks.set(schema, check as Check<unknown>);
  return schema;
}

const run = <T>(schema: Schema<T>, value: unknown, path: Path, issues: Issue[]) =>
  (checks.get(schema) as Check<T>)(value, path, issues);

function primitive<T>(message: string, ok: (value: unknown) => boolean): Schema<T> {
  return make<T>((value, path, issues) => {
    if (!ok(value)) issues.push({ path, message });
    return value as T;
  });
}

export const s = {
  string: () => primitive<string>('Expected string', (v) => typeof v === 'string'),
  number: () => primitive<number>('Expected number', (v) => typeof v === 'number' && !Number.isNaN(v)),
  boolean: () => primitive<boolean>('Expected boolean', (v) => typeof v === 'boolean'),
  literal<V extends string | number | boolean>(value: V): Schema<V> {
    return primitive<V>(`Expected ${JSON.stringify(value)}`, (v) => Object.is(v, value));
  },
  array<T>(item: Schema<T>): Schema<T[]> {
    return make<T[]>((value, path, issues) => {
      if (!Array.isArray(value)) {
        issues.push({ path, message: 'Expected array' });
        return [];
      }
      return value.map((element, i) => run(item, element, [...path, i], issues));
    });
  },
  object<S extends Shape>(shape: S): Schema<{ [K in keyof S]: Infer<S[K]> }> {
    type Out = { [K in keyof S]: Infer<S[K]> };
    return make<Out>((value, path, issues) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        issues.push({ path, message: 'Expected object' });
        return {} as Out;
      }
      const input = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        const parsed = run(shape[key], input[key], [...path, key], issues);
        if (key in input) out[key] = parsed;
      }
      return out as Out;
    });
  },
};
