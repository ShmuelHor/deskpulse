import { describe, expect, it } from 'vitest';

import { RETENTION_TARGETS } from '../../src/jobs/retention.js';

describe('battery retention targets', () => {
  it('keeps battery_daily and alert_state and prunes samples after 90 days', () => {
    expect(RETENTION_TARGETS).toEqual([{ table: 'battery_samples', column: 'ts', retainDays: 90 }]);
  });
});
