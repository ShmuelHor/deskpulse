import { type LocalDateString, splitByLocalDay } from './local-time.js';

/** A closed session as reports counts it: when, which app. */
export interface CountedSession {
  readonly appId: string;
  readonly startMs: number;
  readonly endMs: number;
}

/** Time one app was in use on one local day. */
export interface RollupEntry {
  readonly date: LocalDateString;
  readonly appId: string;
  readonly ms: number;
}

function keyOf(entry: Omit<RollupEntry, 'ms'>): string {
  return JSON.stringify([entry.date, entry.appId]);
}

/**
 * Totals sessions per local day and app. A session that crosses
 * midnight counts on both days, each with the part that fell on it.
 */
export function rollUp(sessions: readonly CountedSession[], zone: string): RollupEntry[] {
  const totals = new Map<string, RollupEntry>();
  for (const session of sessions) {
    for (const slice of splitByLocalDay(session.startMs, session.endMs, zone)) {
      const entry = { date: slice.date, appId: session.appId };
      const key = keyOf(entry);
      totals.set(key, { ...entry, ms: (totals.get(key)?.ms ?? 0) + slice.ms });
    }
  }
  return [...totals.values()];
}
