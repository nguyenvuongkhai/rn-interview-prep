import { z } from 'zod';

export const INTERVIEW_COUNTS = [3, 5, 8] as const;
export type InterviewCount = (typeof INTERVIEW_COUNTS)[number];

export const INTERVIEW_SETTINGS_KEY = 'interview';

export const interviewSettingsSchema = z.object({
  speak: z.boolean(),
  captions: z.boolean(),
  count: z.union([z.literal(3), z.literal(5), z.literal(8)]),
});

export type InterviewSettings = z.infer<typeof interviewSettingsSchema>;

export const DEFAULT_INTERVIEW_SETTINGS: InterviewSettings = { speak: true, captions: true, count: 5 };

/** A stored setting is only trusted when it still matches the schema. */
export function readInterviewSettings(value: unknown): InterviewSettings {
  const parsed = interviewSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_INTERVIEW_SETTINGS;
}
