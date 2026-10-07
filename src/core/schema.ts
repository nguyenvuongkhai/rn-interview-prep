import { z } from 'zod';

export const localized = z.strictObject({ vi: z.string().min(1), en: z.string().min(1) });
export const kind = z.enum(['core', 'advanced', 'pitfall', 'hard-issue']);
/** Lessons add one kind items never use: a hands-on lab. */
export const lessonKind = z.enum(['core', 'advanced', 'pitfall', 'hard-issue', 'lab']);
const oneToThree = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const difficulty = oneToThree;

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be kebab-case');
const topicId = z
  .string()
  .regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/, 'topic id must be kebab-case segments joined by /');

export const misconception = z.strictObject({ id, text: localized });
export const option = z.strictObject({ text: localized, misconception: misconception.optional() });

const base = {
  id,
  topics: z.array(topicId).min(1).max(3),
  kind,
  difficulty,
  estSeconds: z.number().int().positive(),
  lessons: z.array(id).default([]),
};

const mcq = z.strictObject({
  ...base,
  type: z.literal('mcq'),
  prompt: localized,
  options: z.array(option).min(2),
  answer: z.array(z.number().int().nonnegative()).min(1),
  multi: z.boolean(),
  explanation: localized,
});

const spotBug = z.strictObject({
  ...base,
  type: z.literal('spot-bug'),
  prompt: localized,
  code: z.string().min(1),
  answerLine: z.number().int().positive(),
  causeOptions: z.array(option).min(2),
  answerCause: z.number().int().nonnegative(),
  explanation: localized,
});

const open = z.strictObject({
  ...base,
  type: z.literal('open'),
  prompt: localized,
  keyPoints: z.array(localized).min(2),
  modelAnswer: localized,
  followUps: z.array(localized).default([]),
});

export const challengeMeta = z.strictObject({
  ...base,
  type: z.literal('challenge'),
  title: localized,
  hints: z.array(localized).default([]),
});

export const question = z.discriminatedUnion('type', [mcq, spotBug, open]).superRefine((q, ctx) => {
  const fail = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  if (q.type === 'mcq') {
    if (q.answer.some((i) => i >= q.options.length)) fail(['answer'], 'answer index out of range');
    if (new Set(q.answer).size !== q.answer.length) fail(['answer'], 'duplicate answer index');
    if (!q.multi && q.answer.length !== 1) fail(['answer'], 'single-answer mcq must have exactly one answer');
    q.answer.forEach((i) => {
      if (q.options[i]?.misconception) fail(['options', i, 'misconception'], 'a correct option cannot carry a misconception');
    });
  }
  if (q.type === 'spot-bug') {
    if (q.answerLine > q.code.split('\n').length) fail(['answerLine'], 'answerLine is past the end of code');
    if (q.answerCause >= q.causeOptions.length) fail(['answerCause'], 'answerCause index out of range');
    if (q.causeOptions[q.answerCause]?.misconception) {
      fail(['causeOptions', q.answerCause, 'misconception'], 'the correct cause cannot carry a misconception');
    }
  }
});

export const questionFile = z.array(question);

export const topic = z.strictObject({
  id: topicId,
  title: localized,
  parent: topicId.nullable(),
  weight: oneToThree,
  group: z.string().min(1),
});
export const topicsFile = z.array(topic);

export const lessonMeta = z.strictObject({
  id,
  topic: topicId,
  kind: lessonKind,
  readMinutes: z.coerce.number().int().positive(),
});

export const roadmapTrack = z.enum(['rn', 'ios', 'android']);
export const roadmapLevel = z.enum(['middle', 'senior']);
export const roadmapArea = z.strictObject({ id, title: localized });
export const roadmapAreasFile = z.array(roadmapArea);
export const roadmapItem = z.strictObject({
  id,
  track: roadmapTrack,
  level: roadmapLevel,
  area: id,
  title: localized,
  /** what you must know, 2–4 sentences */
  know: localized,
  /** questions to ask yourself */
  check: z.array(localized).min(2).max(4),
  topics: z.array(topicId).default([]),
  lessons: z.array(id).default([]),
});
export const roadmapFile = z.array(roadmapItem);

export const mapLayerId = z.enum(['js', 'runtime', 'ios', 'android']);
export const mapLevelId = z.enum(['junior', 'middle', 'senior']);
export const mapLayer = z.strictObject({
  id: mapLayerId,
  title: localized,
  body: localized,
  parts: z.array(localized).default([]),
});
/** one concept; the platform cells are API and tool names, so they are not translated */
export const mapRow = z.strictObject({
  concept: localized,
  rn: z.string().min(1),
  ios: z.string().min(1),
  android: z.string().min(1),
});
export const mapCheck = z.strictObject({ id, text: localized });
export const mapLevel = z.strictObject({
  id: mapLevelId,
  name: localized,
  tag: localized,
  rn: z.array(localized).min(1),
  ios: z.array(localized).min(1),
  android: z.array(localized).min(1),
  checks: z.array(mapCheck).length(4),
});
export const mapArch = z.strictObject({ old: z.string().min(1), new: z.string().min(1), change: localized });
export const mapStep = z.strictObject({ step: localized, where: z.string().min(1) });
export const mapHabit = z.strictObject({ title: localized, body: localized });
export const mapFile = z.strictObject({
  layers: z.array(mapLayer),
  rows: z.array(mapRow),
  levels: z.array(mapLevel),
  arch: z.array(mapArch),
  trace: z.array(mapStep),
  habits: z.array(mapHabit),
});

export type Localized = z.infer<typeof localized>;
export type Option = z.infer<typeof option>;
export type Kind = z.infer<typeof kind>;
export type LessonKind = z.infer<typeof lessonKind>;
export type Difficulty = z.infer<typeof difficulty>;
export type Question = z.infer<typeof question>;
export type Mcq = Extract<Question, { type: 'mcq' }>;
export type SpotBug = Extract<Question, { type: 'spot-bug' }>;
export type Open = Extract<Question, { type: 'open' }>;
export type ChallengeMeta = z.infer<typeof challengeMeta>;
export type Item = Question | ChallengeMeta;
export type Topic = z.infer<typeof topic>;
export type LessonMeta = z.infer<typeof lessonMeta>;
export type Lesson = LessonMeta & { body: Localized };
export type RoadmapTrack = z.infer<typeof roadmapTrack>;
export type RoadmapLevel = z.infer<typeof roadmapLevel>;
export type RoadmapArea = z.infer<typeof roadmapArea>;
export type RoadmapItem = z.infer<typeof roadmapItem>;
export type MapLayerId = z.infer<typeof mapLayerId>;
export type MapLevelId = z.infer<typeof mapLevelId>;
export type MapLayer = z.infer<typeof mapLayer>;
export type MapRow = z.infer<typeof mapRow>;
export type MapLevel = z.infer<typeof mapLevel>;
export type KnowledgeMap = z.infer<typeof mapFile>;
