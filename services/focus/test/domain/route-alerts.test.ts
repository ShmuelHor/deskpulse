import { type Alert, AlertType } from '@deskpulse/shared/alerts';
import { describe, expect, it } from 'vitest';

import {
  decide,
  isRateLimited,
  RATE_LIMIT_MS,
  routeAlerts,
} from '../../src/domain/route-alerts.js';

const NOW_MS = Date.parse('2026-11-08T10:00:00.000Z');
const NOTHING_SENT = new Map<string, number>();

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    alertKey: 'battery-low:15',
    type: 'battery-low',
    ts: '2026-11-08T09:59:00.000Z',
    params: { percent: 14 },
    ...overrides,
  };
}

describe('decide', () => {
  it('queues every alert type during focus except battery-critical', () => {
    const queued = AlertType.options.filter((type) => decide(type, true) === 'queue');

    expect(queued).toEqual(AlertType.options.filter((type) => type !== 'battery-critical'));
    expect(decide('battery-critical', true)).toBe('deliver');
  });

  it.each(AlertType.options)('delivers %s outside focus', (type) => {
    expect(decide(type, false)).toBe('deliver');
  });
});

describe('isRateLimited', () => {
  it('limits a key let through less than 10 min ago and frees it at exactly 10 min', () => {
    expect(isRateLimited(undefined, NOW_MS)).toBe(false);
    expect(isRateLimited(NOW_MS - RATE_LIMIT_MS + 1, NOW_MS)).toBe(true);
    expect(isRateLimited(NOW_MS - RATE_LIMIT_MS, NOW_MS)).toBe(false);
  });
});

describe('routeAlerts', () => {
  const types: AlertType[] = ['battery-critical', 'thermal', 'pressure-incident'];

  it('queues everything but battery-critical during focus', () => {
    const alerts = types.map((type) => alert({ alertKey: `k-${type}`, type }));

    const outcome = routeAlerts({
      alerts,
      inFocus: true,
      lastAccepted: NOTHING_SENT,
      nowMs: NOW_MS,
    });

    expect(outcome.deliver.map((a) => a.type)).toEqual(['battery-critical']);
    expect(outcome.queue.map((a) => a.type)).toEqual(['thermal', 'pressure-incident']);
  });

  it('delivers every type outside focus', () => {
    const alerts = types.map((type) => alert({ alertKey: `k-${type}`, type }));

    const outcome = routeAlerts({
      alerts,
      inFocus: false,
      lastAccepted: NOTHING_SENT,
      nowMs: NOW_MS,
    });

    expect(outcome.deliver.map((a) => a.type)).toEqual(types);
    expect(outcome.queue).toEqual([]);
  });

  it('drops an alert whose key was let through in the last 10 min, even an empty battery', () => {
    const outcome = routeAlerts({
      alerts: [alert({ type: 'battery-critical' })],
      inFocus: false,
      lastAccepted: new Map([['battery-low:15', NOW_MS - RATE_LIMIT_MS + 1]]),
      nowMs: NOW_MS,
    });

    expect(outcome).toEqual({ deliver: [], queue: [], limited: 1, acceptedKeys: [] });
  });

  it('counts a queued alert against the rate limit, so a repeat in the same batch is dropped', () => {
    const outcome = routeAlerts({
      alerts: [alert(), alert({ ts: '2026-11-08T09:59:30.000Z' }), alert({ alertKey: 'other' })],
      inFocus: true,
      lastAccepted: NOTHING_SENT,
      nowMs: NOW_MS,
    });

    expect(outcome.queue.map((a) => a.alertKey)).toEqual(['battery-low:15', 'other']);
    expect(outcome.limited).toBe(1);
    expect(outcome.acceptedKeys).toEqual(['battery-low:15', 'other']);
  });

  it('lets a key through again once its window has passed', () => {
    const outcome = routeAlerts({
      alerts: [alert()],
      inFocus: false,
      lastAccepted: new Map([['battery-low:15', NOW_MS - RATE_LIMIT_MS]]),
      nowMs: NOW_MS,
    });

    expect(outcome.deliver).toHaveLength(1);
    expect(outcome.acceptedKeys).toEqual(['battery-low:15']);
  });
});
