import type { Topic } from './schema';

/** Topics with no children — where diagnoses and gaps are reported. */
export function leafTopics(topics: Topic[]): Topic[] {
  const parents = new Set(topics.map((t) => t.parent).filter((p): p is string => p !== null));
  return topics.filter((t) => !parents.has(t.id));
}
