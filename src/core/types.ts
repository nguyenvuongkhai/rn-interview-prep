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

export interface Picked {
  selected?: number[];
  line?: number;
  cause?: number;
  hitKeyPoints?: number[];
}

/** What a mock interview adds to an open-question attempt. */
export interface InterviewRecord {
  transcript: string;
  /** key points the AI said were covered, to compare with the final ticks */
  aiCovered: number[];
  feedback?: string;
  followUp?: string;
  followUpTranscript?: string;
  followUpFeedback?: string;
  /** 'ai' when Workers AI graded it, 'manual' when the user ticked the points alone */
  gradedBy: 'ai' | 'manual';
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
  /** what the user picked, so the Result screen can show it next to the answer key */
  picked?: Picked;
  /** set only for attempts made in a mock interview */
  interview?: InterviewRecord;
}

export interface ReviewState {
  itemId: string;
  /** index into BOX_DAYS */
  box: number;
  /** epoch ms */
  dueAt: number;
}
