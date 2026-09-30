import { loadContent } from './load';

const topics = import.meta.glob('/content/topics.json', { eager: true, import: 'default' });
const questionFiles = import.meta.glob('/content/questions/*.json', { eager: true, import: 'default' });
const challengeFiles = import.meta.glob('/content/challenges/*/meta.json', { eager: true, import: 'default' });
const lessonFiles = import.meta.glob<string>('/content/lessons/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** Validated at import time: a broken content file fails `npm run check` and the build. */
export const content = loadContent({
  topics: topics['/content/topics.json'],
  questionFiles,
  challengeFiles,
  lessonFiles,
});
