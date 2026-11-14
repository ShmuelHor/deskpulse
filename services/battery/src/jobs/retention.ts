import type { Job } from '@deskpulse/service-kit/job';
import { createRetentionJob, type RetentionTarget } from '@deskpulse/service-kit/retention';
import { createQueryBuilder } from '@deskpulse/service-kit/sql';
import type { PostgresPool } from 'kysely';
import type { Logger } from 'pino';

const RAW_RETENTION_DAYS = 90;

/** Raw rows only: battery_daily and alert_state are kept. */
export const RETENTION_TARGETS: readonly RetentionTarget[] = [
  { table: 'battery_samples', column: 'ts', retainDays: RAW_RETENTION_DAYS },
];

/** The nightly job that silently deletes raw rows past retention (SPEC §5, gateway retention). */
export function createRetention(deps: { db: PostgresPool; log: Logger }): Job {
  return createRetentionJob({
    db: createQueryBuilder<unknown>(deps.db),
    log: deps.log,
    targets: RETENTION_TARGETS,
  });
}
