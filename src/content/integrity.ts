import type { Item, KnowledgeMap, Lesson, MapLevelId, RoadmapArea, RoadmapItem, Topic } from '../core/schema';

/** Cross-file checks the per-file schemas cannot see. Returns human-readable issues. */
export function checkIntegrity(topics: Topic[], items: Item[], lessons: Lesson[]): string[] {
  const issues: string[] = [];
  const topicIds = new Set<string>();
  for (const t of topics) {
    if (topicIds.has(t.id)) issues.push(`duplicate topic "${t.id}"`);
    topicIds.add(t.id);
  }

  const parentOf = new Map(topics.map((t) => [t.id, t.parent]));
  for (const t of topics) {
    if (t.parent !== null && !topicIds.has(t.parent)) {
      issues.push(`topic "${t.id}": unknown parent "${t.parent}"`);
      continue;
    }
    let cursor: string | null = t.parent;
    for (let steps = 0; cursor !== null; steps++) {
      if (steps > topics.length || cursor === t.id) {
        issues.push(`topic "${t.id}": parent chain has a cycle`);
        break;
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  const seen = new Set<string>();
  for (const id of [...items.map((i) => i.id), ...lessons.map((l) => l.id)]) {
    if (seen.has(id)) issues.push(`duplicate id "${id}"`);
    seen.add(id);
  }

  const lessonIds = new Set(lessons.map((l) => l.id));
  for (const item of items) {
    for (const t of item.topics) if (!topicIds.has(t)) issues.push(`item "${item.id}": unknown topic "${t}"`);
    for (const l of item.lessons) if (!lessonIds.has(l)) issues.push(`item "${item.id}": unknown lesson "${l}"`);
  }
  for (const lesson of lessons) {
    if (!topicIds.has(lesson.topic)) issues.push(`lesson "${lesson.id}": unknown topic "${lesson.topic}"`);
  }
  return issues;
}

/** Roadmap references must point at real areas, topics and lessons. */
export function checkRoadmap(areas: RoadmapArea[], items: RoadmapItem[], topics: Topic[], lessons: Lesson[]): string[] {
  const issues: string[] = [];
  const areaIds = new Set<string>();
  for (const a of areas) {
    if (areaIds.has(a.id)) issues.push(`duplicate roadmap area "${a.id}"`);
    areaIds.add(a.id);
  }
  const topicIds = new Set(topics.map((t) => t.id));
  const lessonIds = new Set(lessons.map((l) => l.id));
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      issues.push(`duplicate roadmap item "${item.id}"`);
      continue;
    }
    seen.add(item.id);
    if (!areaIds.has(item.area)) issues.push(`roadmap item "${item.id}": unknown area "${item.area}"`);
    for (const t of item.topics) if (!topicIds.has(t)) issues.push(`roadmap item "${item.id}": unknown topic "${t}"`);
    for (const l of item.lessons) if (!lessonIds.has(l)) issues.push(`roadmap item "${item.id}": unknown lesson "${l}"`);
  }
  return issues;
}

const MAP_LEVELS: MapLevelId[] = ['junior', 'middle', 'senior'];

/** The level tabs and the stored ticks rely on these: three levels in order, and stable unique check ids. */
export function checkMap(map: KnowledgeMap): string[] {
  const issues: string[] = [];
  const layerIds = new Set<string>();
  for (const layer of map.layers) {
    if (layerIds.has(layer.id)) issues.push(`duplicate map layer "${layer.id}"`);
    layerIds.add(layer.id);
  }
  const levelIds = map.levels.map((l) => l.id);
  if (levelIds.length > 0 && levelIds.join() !== MAP_LEVELS.join()) {
    issues.push(`map levels must be ${MAP_LEVELS.join(', ')} in that order`);
  }
  const seen = new Set<string>();
  for (const level of map.levels) {
    for (const check of level.checks) {
      const prefix = `map-${level.id}-`;
      if (!check.id.startsWith(prefix)) issues.push(`map check "${check.id}": id must start with "${prefix}"`);
      if (seen.has(check.id)) issues.push(`duplicate map check "${check.id}"`);
      seen.add(check.id);
    }
  }
  return issues;
}
