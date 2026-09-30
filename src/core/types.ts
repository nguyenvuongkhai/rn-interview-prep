export type Lang = 'vi' | 'en';
export type Confidence = 'guess' | 'fairly' | 'sure';

export const DAY_MS = 86_400_000;

export interface TestResult {
  name: string;
  category: string;
  pass: boolean;
  error?: string;
  hidden: boolean;
}

export interface Attempt {
  id: string;
  itemId: string;
  sessionId: string;
  /** 0..1, from grade() */
  score: number;
  /** seconds */
  timeSpent: number;
  confidence: Confidence;
  usedHints: number;
  lang: Lang;
  /** epoch ms */
  at: number;
  /** from grade(): misconceptions of the wrong options picked */
  misconceptionIds: string[];
  testResults?: TestResult[];
}

export interface ReviewState {
  itemId: string;
  /** index into BOX_DAYS */
  box: number;
  /** epoch ms */
  dueAt: number;
}
