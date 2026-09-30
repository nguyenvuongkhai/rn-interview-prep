import type { Item, LessonMeta, Topic } from './schema';
import type { Attempt } from './types';
import { attemptsForTopic, masteryOf, type Mastery } from './mastery';
import { PASS_SCORE } from './scheduler';
import { leafTopics } from './topics';

export type Diagnosis =
  | { code: 'lacks-practice'; topicId: string; core: number; practice: number }
  | { code: 'cant-explain'; topicId: string; recognise: number; explain: number }
  | { code: 'shaky'; topicId: string; guessRatio: number }
  | { code: 'challenge-category'; category: string; failures: number }
  | { code: 'misconception'; misconceptionId: string; occurrences: number };

export const RULES = {
  solid: 0.8,
  weakPractice: 0.5,
  weakExplain: 0.6,
  guessRatio: 0.4,
  minCore: 3,
  minPractice: 2,
  minRecognise: 3,
  minExplain: 1,
  minCorrect: 3,
  minRepeat: 2,
} as const;

const isCore = (i: Item) => i.kind === 'core';
const isPractice = (i: Item) => i.kind === 'pitfall' || i.kind === 'hard-issue';
const isRecognise = (i: Item) => i.type === 'mcq';
const isExplain = (i: Item) => i.type === 'open';

const countBy = (keys: Iterable<string>, into: Map<string, number>) => {
  for (const k of keys) into.set(k, (into.get(k) ?? 0) + 1);
};

export function diagnose(topics: Topic[], attempts: Attempt[], itemsById: Map<string, Item>, now: number): Diagnosis[] {
  const out: Diagnosis[] = [];
  const slice = (topicId: string, filter?: (i: Item) => boolean) =>
    masteryOf(attemptsForTopic(topicId, attempts, itemsById, filter), itemsById, now);

  for (const t of leafTopics(topics)) {
    const core = slice(t.id, isCore);
    const practice = slice(t.id, isPractice);
    if (
      core.value !== null && practice.value !== null &&
      core.count >= RULES.minCore && practice.count >= RULES.minPractice &&
      core.value >= RULES.solid && practice.value < RULES.weakPractice
    ) {
      out.push({ code: 'lacks-practice', topicId: t.id, core: core.value, practice: practice.value });
    }

    const recognise = slice(t.id, isRecognise);
    const explain = slice(t.id, isExplain);
    if (
      recognise.value !== null && explain.value !== null &&
      recognise.count >= RULES.minRecognise && explain.count >= RULES.minExplain &&
      recognise.value >= RULES.solid && explain.value < RULES.weakExplain
    ) {
      out.push({ code: 'cant-explain', topicId: t.id, recognise: recognise.value, explain: explain.value });
    }

    const correct = attemptsForTopic(t.id, attempts, itemsById).filter((a) => a.score >= PASS_SCORE);
    if (correct.length >= RULES.minCorrect) {
      const guessRatio = correct.filter((a) => a.confidence === 'guess').length / correct.length;
      if (guessRatio >= RULES.guessRatio) out.push({ code: 'shaky', topicId: t.id, guessRatio });
    }
  }

  const categoryFailures = new Map<string, number>();
  const misconceptions = new Map<string, number>();
  for (const a of attempts) {
    // each counts once per attempt
    countBy(new Set((a.testResults ?? []).filter((r) => !r.pass).map((r) => r.category)), categoryFailures);
    countBy(new Set(a.misconceptionIds), misconceptions);
  }
  const repeated = (m: Map<string, number>) =>
    [...m].filter(([, n]) => n >= RULES.minRepeat).sort(([a, x], [b, y]) => y - x || a.localeCompare(b));

  for (const [category, failures] of repeated(categoryFailures)) out.push({ code: 'challenge-category', category, failures });
  for (const [misconceptionId, occurrences] of repeated(misconceptions)) out.push({ code: 'misconception', misconceptionId, occurrences });
  return out;
}

export type PlanStep =
  | { kind: 'read'; lessonId: string; minutes: number }
  | { kind: 'practice'; itemIds: string[]; minutes: number }
  | { kind: 'challenge'; itemId: string; minutes: number };

export interface Gap {
  topicId: string;
  mastery: number;
  priority: number;
  plan: PlanStep[];
}

export const PRACTICE_COUNT = 3;

export interface GapInput {
  topics: Topic[];
  mastery: Map<string, Mastery>;
  items: Item[];
  lessons: LessonMeta[];
  attempts: Attempt[];
}

export function topGaps({ topics, mastery, items, lessons, attempts }: GapInput, limit = 3): Gap[] {
  const latest = latestScoreByItem(attempts);
  return leafTopics(topics)
    .flatMap((t) => {
      const m = mastery.get(t.id);
      if (!m || m.level === 'insufficient' || m.value === null || m.value >= RULES.solid) return [];
      return [{ topicId: t.id, mastery: m.value, priority: (1 - m.value) * t.weight, plan: planFor(t.id, items, lessons, latest) }];
    })
    .sort((a, b) => b.priority - a.priority || a.topicId.localeCompare(b.topicId))
    .slice(0, limit);
}

function latestScoreByItem(attempts: Attempt[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) out.set(a.itemId, a.score);
  return out;
}

function planFor(topicId: string, items: Item[], lessons: LessonMeta[], latest: Map<string, number>): PlanStep[] {
  const steps: PlanStep[] = [];
  const lesson = lessons.filter((l) => l.topic === topicId).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (lesson) steps.push({ kind: 'read', lessonId: lesson.id, minutes: lesson.readMinutes });

  // unattempted (-1) first, then lowest latest score
  const byNeed = (a: Item, b: Item) => (latest.get(a.id) ?? -1) - (latest.get(b.id) ?? -1) || a.id.localeCompare(b.id);
  const own = items.filter((i) => i.topics[0] === topicId);

  const practice = own.filter((i) => i.type !== 'challenge').sort(byNeed).slice(0, PRACTICE_COUNT);
  if (practice.length > 0) {
    const seconds = practice.reduce((s, i) => s + i.estSeconds, 0);
    steps.push({ kind: 'practice', itemIds: practice.map((i) => i.id), minutes: Math.ceil(seconds / 60) });
  }

  const ch = own.filter((i) => i.type === 'challenge').sort(byNeed)[0];
  if (ch) steps.push({ kind: 'challenge', itemId: ch.id, minutes: Math.ceil(ch.estSeconds / 60) });
  return steps;
}
