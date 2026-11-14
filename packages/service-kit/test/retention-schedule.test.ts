import { describe, expect, it } from 'vitest';

import { msUntilNextRun, retentionCutoff } from '../src/retention-schedule.js';

const HOUR = 3_600_000;
const HOURS_PER_DAY = 24;
const DAY = HOURS_PER_DAY * HOUR;
const RETAIN_90 = 90;
const RETAIN_7 = 7;
const RUN_HOUR = 3;
const ONE_SECOND = 1_000;
const TWO = 2;
const TWENTY_THREE = 23;

describe('retentionCutoff', () => {
  it('is exactly the retention period before now', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    expect(retentionCutoff(now, RETAIN_90)).toEqual(new Date(now.getTime() - RETAIN_90 * DAY));
  });

  it('keeps a row that is one second younger than the period', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const row = new Date(retentionCutoff(now, RETAIN_7).getTime() + ONE_SECOND);
    expect(row < retentionCutoff(now, RETAIN_7)).toBe(false);
  });
});

describe('msUntilNextRun', () => {
  it('waits for later today when the hour has not come yet', () => {
    expect(msUntilNextRun(new Date('2026-11-14T01:00:00Z'), RUN_HOUR)).toBe(TWO * HOUR);
  });

  it('waits for tomorrow when the hour has passed', () => {
    expect(msUntilNextRun(new Date('2026-11-14T04:00:00Z'), RUN_HOUR)).toBe(TWENTY_THREE * HOUR);
  });

  it('waits a full day when it is exactly the hour, so a run never repeats', () => {
    expect(msUntilNextRun(new Date('2026-11-14T03:00:00Z'), RUN_HOUR)).toBe(DAY);
  });

  it('defaults to 03:00 UTC', () => {
    expect(msUntilNextRun(new Date('2026-11-14T00:00:00Z'))).toBe(RUN_HOUR * HOUR);
  });
});
