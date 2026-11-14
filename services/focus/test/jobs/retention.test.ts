import { describe, expect, it } from 'vitest';

import { RETENTION_TARGETS } from '../../src/jobs/retention.js';

describe('focus retention targets', () => {
  it('prunes held alerts after 90 days and keeps profiles and focus sessions', () => {
    expect(RETENTION_TARGETS).toEqual([
      { table: 'queued_alerts', column: 'queued_at', retainDays: 90 },
    ]);
  });
});
