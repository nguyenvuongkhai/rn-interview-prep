import { describe, expect, it } from 'vitest';
import { DEFAULT_INTERVIEW_SETTINGS, readInterviewSettings } from './settings';

describe('interview settings', () => {
  it('keeps a valid stored value', () => {
    expect(readInterviewSettings({ speak: false, captions: true, count: 8 })).toEqual({ speak: false, captions: true, count: 8 });
  });

  it('falls back to the defaults for missing or broken values', () => {
    expect(readInterviewSettings(undefined)).toEqual(DEFAULT_INTERVIEW_SETTINGS);
    expect(readInterviewSettings({ speak: 'yes', captions: true, count: 5 })).toEqual(DEFAULT_INTERVIEW_SETTINGS);
    expect(readInterviewSettings({ speak: true, captions: true, count: 4 })).toEqual(DEFAULT_INTERVIEW_SETTINGS);
  });
});
