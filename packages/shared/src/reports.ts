import { z } from 'zod';
import { AppId, LocalDate, Seconds } from './common.js';
import { LIMITS } from './limits.js';

export const AppTotal = z.strictObject({ appId: AppId, seconds: Seconds });
export type AppTotal = z.infer<typeof AppTotal>;

export const DayReport = z.strictObject({
  date: LocalDate,
  totalSeconds: Seconds,
  topApps: z.array(AppTotal).max(LIMITS.listSize),
  longestFocusStreakSeconds: Seconds,
});
export type DayReport = z.infer<typeof DayReport>;

export const WeekQuery = z.strictObject({ start: LocalDate });
export type WeekQuery = z.infer<typeof WeekQuery>;

export const WeeklySummary = z.strictObject({
  totalSeconds: Seconds,
  /** Change against the previous week; `null` when there is no previous week. */
  changePct: z.number().finite().nullable(),
});
export type WeeklySummary = z.infer<typeof WeeklySummary>;

export const WeekReport = z.strictObject({
  start: LocalDate,
  days: z.array(DayReport).length(LIMITS.daysPerWeek),
  topApps: z.array(AppTotal).max(LIMITS.listSize),
  summary: WeeklySummary,
});
export type WeekReport = z.infer<typeof WeekReport>;
