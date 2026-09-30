import type { Lang } from '../core/types';

/** mm:ss; negative seconds are overtime and show as +mm:ss. */
export function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  const abs = Math.abs(s);
  return `${s < 0 ? '+' : ''}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export function formatScore(value: number): string {
  return value.toFixed(2);
}

/** Replaces {name} slots; unknown slots stay as written so a missing value is visible. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (slot, key: string) => (key in vars ? String(vars[key]) : slot));
}

export const otherLang = (lang: Lang): Lang => (lang === 'vi' ? 'en' : 'vi');
