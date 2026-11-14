import type { Job } from '@deskpulse/service-kit/job';
import { createRetentionJob, type RetentionTarget } from '@deskpulse/service-kit/retention';
import { createQueryBuilder } from '@deskpulse/service-kit/sql';
import type { PostgresPool } from 'kysely';
import type { Logger } from 'pino';

/** SPEC §5 system: shorter than the 90-day default. */
const RAW_RETENTION_DAYS = 7;

/** Raw rows only: incidents (the summaries) and the condition state are kept. */
export const RETENTION_TARGETS: readonly RetentionTarget[] = [
  { table: 'pressure_samples', column: 'ts', retainDays: RAW_RETENTION_DAYS },
  { table: 'process_snapshots', column: 'ts', retainDays: RAW_RETENTION_DAYS },
];

/** The nightly job that silently deletes raw rows past retention (SPEC §5, gateway retention). */
export function createRetention(deps: { db: PostgresPool; log: Logger }): Job {
  return createRetentionJob({
    db: createQueryBuilder<unknown>(deps.db),
    log: deps.log,
    targets: RETENTION_TARGETS,
  });
}
