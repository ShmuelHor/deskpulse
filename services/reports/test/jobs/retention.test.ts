import { describe, expect, it } from 'vitest';

import { RETENTION_TARGETS } from '../../src/jobs/retention.js';

describe('reports retention targets', () => {
  it('prunes the counted-session ledger after 90 days and keeps rollups and streaks', () => {
    expect(RETENTION_TARGETS).toEqual([
      { table: 'counted_sessions', column: 'end_at', retainDays: 90 },
    ]);
  });
});
