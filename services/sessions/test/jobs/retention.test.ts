import { describe, expect, it } from 'vitest';

import { RETENTION_TARGETS } from '../../src/jobs/retention.js';

describe('sessions retention targets', () => {
  it('prunes sessions after 90 days and keeps apps', () => {
    expect(RETENTION_TARGETS).toEqual([{ table: 'sessions', column: 'end_at', retainDays: 90 }]);
  });
});
