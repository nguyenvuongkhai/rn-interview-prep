import { loadContent } from './load';

const topics = import.meta.glob('/content/topics.json', { eager: true, import: 'default' });
const questionFiles = import.meta.glob('/content/questions/*.json', { eager: true, import: 'default' });
const challengeFiles = import.meta.glob('/content/challenges/*/meta.json', { eager: true, import: 'default' });
const challengeTexts = import.meta.glob<string>('/content/challenges/*/*.{md,ts}', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const lessonFiles = import.meta.glob<string>('/content/lessons/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const roadmapAreas = import.meta.glob('/content/roadmap/areas.json', { eager: true, import: 'default' });
const roadmapFiles = import.meta.glob(['/content/roadmap/*.json', '!/content/roadmap/areas.json'], {
  eager: true,
  import: 'default',
});

/** Validated at import time: a broken content file fails `npm run check` and the build. */
export const content = loadContent({
  topics: topics['/content/topics.json'],
  questionFiles,
  challengeFiles,
  challengeTexts,
  lessonFiles,
  roadmapAreas: roadmapAreas['/content/roadmap/areas.json'],
  roadmapFiles,
});
