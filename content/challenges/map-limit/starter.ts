export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  // TODO: never run more than `limit` calls of fn at once
  throw new Error('Not implemented');
}
