import { type Kysely, sql } from 'kysely';
import type { Logger } from 'pino';

import type { Job } from './job.js';
import { msUntilNextRun, retentionCutoff } from './retention-schedule.js';

const DEFAULT_BATCH_SIZE = 5_000;
/** A machine that was off at night still catches up shortly after a start; the work is batched, so it is cheap. */
const STARTUP_DELAY_MS = 60_000;
/** Table and column names are constants, but the check keeps a bad one from ever reaching SQL. */
const IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

/** Raw rows of one table: deleted once `column` is older than `retainDays`. Rollups and summaries are never listed. */
export interface RetentionTarget {
  readonly table: string;
  /** A `timestamptz` column. */
  readonly column: string;
  readonly retainDays: number;
}

export interface RetentionOptions {
  readonly db: Kysely<unknown>;
  readonly log: Logger;
  readonly targets: readonly RetentionTarget[];
  readonly now?: () => Date;
  /** Milliseconds until the next scheduled run, from the current time. */
  readonly msUntilNext?: (now: Date) => number;
  /** Run once shortly after start. Defaults to true. */
  readonly runOnStart?: boolean;
  readonly batchSize?: number;
}

/** Deletes at most `limit` rows older than `cutoff`; returns how many it deleted. */
export async function deleteBatch(
  db: Kysely<unknown>,
  target: RetentionTarget,
  cutoff: Date,
  limit: number,
): Promise<number> {
  if (!IDENTIFIER.test(target.table) || !IDENTIFIER.test(target.column)) {
    throw new Error('Invalid retention target');
  }
  const table = sql.id(target.table);
  const column = sql.id(target.column);
  // ctid picks the batch without needing a key, so keyless tables (process_snapshots) work too.
  const result = await sql`
    DELETE FROM ${table}
    WHERE ctid IN (SELECT ctid FROM ${table} WHERE ${column} < ${cutoff} LIMIT ${limit})
  `.execute(db);
  return Number(result.numAffectedRows ?? 0);
}

/** Deletes everything past retention, one bounded batch at a time. Returns rows deleted per table. */
export async function runRetention(
  options: Required<Pick<RetentionOptions, 'db' | 'targets' | 'batchSize'>> & { now: Date },
): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};
  for (const target of options.targets) {
    const cutoff = retentionCutoff(options.now, target.retainDays);
    let total = 0;
    for (;;) {
      const count = await deleteBatch(options.db, target, cutoff, options.batchSize);
      total += count;
      if (count < options.batchSize) {
        break;
      }
    }
    deleted[target.table] = total;
  }
  return deleted;
}

/**
 * The nightly retention job. A failed run is logged and retried the next night;
 * runs never overlap. The log line carries counts only, never row content.
 */
export function createRetentionJob(options: RetentionOptions): Job {
  const now = options.now ?? ((): Date => new Date());
  const msUntilNext = options.msUntilNext ?? ((at: Date): number => msUntilNextRun(at));
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | undefined;
  let stopped = true;

  const run = async (): Promise<void> => {
    try {
      const deleted = await runRetention({
        db: options.db,
        targets: options.targets,
        batchSize,
        now: now(),
      });
      const total = Object.values(deleted).reduce((sum, count) => sum + count, 0);
      options.log.info({ deleted: total, tables: deleted }, 'Retention finished');
    } catch (error) {
      options.log.error({ err: error }, 'Retention failed');
    }
  };

  const schedule = (delayMs: number): void => {
    timer = setTimeout(() => {
      running = run().finally(() => {
        running = undefined;
        if (!stopped) {
          schedule(msUntilNext(now()));
        }
      });
    }, delayMs);
    timer.unref();
  };

  return {
    start: (): void => {
      stopped = false;
      schedule(options.runOnStart === false ? msUntilNext(now()) : STARTUP_DELAY_MS);
    },
    stop: async (): Promise<void> => {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
}
