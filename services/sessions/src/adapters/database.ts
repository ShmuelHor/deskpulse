import type { Timestamp } from '@deskpulse/service-kit/sql';
import type { Generated } from 'kysely';

export interface AppsTable {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly created_at: Generated<Date>;
}

export interface SessionsTable {
  readonly id: Generated<string>;
  readonly app_id: string;
  readonly start_at: Timestamp;
  readonly end_at: Timestamp;
  readonly closed: Generated<boolean>;
}

export interface SampleWatermarkTable {
  readonly id: Generated<boolean>;
  readonly recorded_until: Timestamp;
}

/** The `sessions` schema, as its migrations create it. */
export interface SessionsDatabase {
  readonly apps: AppsTable;
  readonly sessions: SessionsTable;
  readonly sample_watermark: SampleWatermarkTable;
}
