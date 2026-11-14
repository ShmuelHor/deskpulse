const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** The hour (UTC) the nightly job runs at; the machine is usually idle then. */
export const DEFAULT_RUN_HOUR_UTC = 3;

/** The moment before which a row is old enough to delete: exactly `retainDays` x 24 h ago. */
export function retentionCutoff(now: Date, retainDays: number): Date {
  return new Date(now.getTime() - retainDays * MS_PER_DAY);
}

/** Milliseconds until the next `hourUtc`:00 UTC strictly after `now`, so a run never repeats itself. */
export function msUntilNextRun(now: Date, hourUtc: number = DEFAULT_RUN_HOUR_UTC): number {
  const nowMs = now.getTime();
  const startOfDay = nowMs - (((nowMs % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
  const today = startOfDay + hourUtc * MS_PER_HOUR;
  return (today > nowMs ? today : today + MS_PER_DAY) - nowMs;
}
