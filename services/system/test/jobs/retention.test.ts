import { describe, expect, it } from 'vitest';

import { RETENTION_TARGETS } from '../../src/jobs/retention.js';

describe('system retention targets', () => {
  it('prunes pressure samples and process snapshots after 7 days, never incidents', () => {
    expect(RETENTION_TARGETS).toEqual([
      { table: 'pressure_samples', column: 'ts', retainDays: 7 },
      { table: 'process_snapshots', column: 'ts', retainDays: 7 },
    ]);
  });
});
