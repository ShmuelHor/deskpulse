import type { Kysely, PostgresPool, PostgresPoolClient } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRetentionJob, runRetention } from '../src/retention.js';
import { createQueryBuilder } from '../src/sql.js';
import { recordingLogger } from './log-capture.js';

interface Recorded {
  readonly text: string;
  readonly values: readonly unknown[];
}

/** A pool whose DELETEs affect the next number in `affected`, then 0. */
function fakeDb(affected: number[]): { db: Kysely<unknown>; queries: Recorded[] } {
  const queries: Recorded[] = [];
  const client = {
    query: (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      const rowCount = affected.shift() ?? 0;
      return Promise.resolve({ command: 'DELETE', rowCount, rows: [] });
    },
    release: () => undefined,
  } as unknown as PostgresPoolClient;
  const pool: PostgresPool = {
    options: {},
    connect: async () => client,
    end: async () => undefined,
  };
  return { db: createQueryBuilder<unknown>(pool), queries };
}

const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;
const BATCH = 10;
const SHORT_BATCH = 3;
const LAST_BATCH = 2;
const FOUR_QUERIES = 4;
const FIVE = 5;
const RETAIN = 90;
const NOW = new Date('2026-11-14T10:00:00Z');

describe('runRetention', () => {
  it('binds the cutoff and the batch size instead of building them into the SQL', async () => {
    const { db, queries } = fakeDb([SHORT_BATCH]);

    await runRetention({
      db,
      now: NOW,
      batchSize: BATCH,
      targets: [{ table: 'battery_samples', column: 'ts', retainDays: RETAIN }],
    });

    expect(queries[0]?.text).toContain('DELETE FROM "battery_samples"');
    expect(queries[0]?.values).toEqual([new Date('2026-08-16T10:00:00Z'), BATCH]);
  });

  it('repeats full batches until a short one, and reports the total per table', async () => {
    const { db, queries } = fakeDb([BATCH, BATCH, FOUR_QUERIES, LAST_BATCH]);

    const deleted = await runRetention({
      db,
      now: NOW,
      batchSize: BATCH,
      targets: [
        { table: 'pressure_samples', column: 'ts', retainDays: RETAIN },
        { table: 'process_snapshots', column: 'ts', retainDays: RETAIN },
      ],
    });

    expect(deleted).toEqual({
      pressure_samples: BATCH + BATCH + FOUR_QUERIES,
      process_snapshots: LAST_BATCH,
    });
    expect(queries).toHaveLength(FOUR_QUERIES);
  });

  it('rejects a table name that is not a plain identifier', async () => {
    const { db } = fakeDb([]);

    await expect(
      runRetention({
        db,
        now: NOW,
        batchSize: BATCH,
        targets: [{ table: 'x; drop table y', column: 'ts', retainDays: 1 }],
      }),
    ).rejects.toThrow('Invalid retention target');
  });
});

describe('createRetentionJob', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const targets = [{ table: 'battery_samples', column: 'ts', retainDays: RETAIN }];

  it('logs one line with the number of deleted rows', async () => {
    const { db } = fakeDb([SHORT_BATCH]);
    const { logger, lines } = recordingLogger();
    const job = createRetentionJob({ db, log: logger, targets });

    job.start();
    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    await job.stop();

    const finished = lines.filter((line) => line.msg === 'Retention finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({
      deleted: SHORT_BATCH,
      tables: { battery_samples: SHORT_BATCH },
    });
  });

  it('runs again at the next scheduled time, not before', async () => {
    const { db, queries } = fakeDb([]);
    const { logger } = recordingLogger();
    const job = createRetentionJob({
      db,
      log: logger,
      targets,
      runOnStart: false,
      msUntilNext: () => SECOND_MS,
    });

    job.start();
    await vi.advanceTimersByTimeAsync(SECOND_MS - 1);
    expect(queries).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(queries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(SECOND_MS);
    expect(queries).toHaveLength(2);
    await job.stop();
  });

  it('logs a failed run and keeps the schedule', async () => {
    const { db } = fakeDb([]);
    const { logger, lines } = recordingLogger();
    const failing = createRetentionJob({
      db,
      log: logger,
      targets: [{ table: 'bad table', column: 'ts', retainDays: 1 }],
      runOnStart: false,
      msUntilNext: () => SECOND_MS,
    });

    failing.start();
    await vi.advanceTimersByTimeAsync(2 * SECOND_MS);
    await failing.stop();

    expect(lines.filter((line) => line.msg === 'Retention failed')).toHaveLength(2);
  });

  it('does not run after it is stopped', async () => {
    const { db, queries } = fakeDb([]);
    const { logger } = recordingLogger();
    const job = createRetentionJob({
      db,
      log: logger,
      targets,
      runOnStart: false,
      msUntilNext: () => SECOND_MS,
    });

    job.start();
    await job.stop();
    await vi.advanceTimersByTimeAsync(FIVE * SECOND_MS);

    expect(queries).toHaveLength(0);
  });
});
