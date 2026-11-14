import type { Alert, AlertType } from '@deskpulse/shared/alerts';
import type { Profile } from '@deskpulse/shared/focus';
import { describe, expect, it } from 'vitest';

import { RouteResult } from '../../src/contracts.js';
import { startFocus } from '../../src/use-cases/focus-sessions.js';
import { listQueue, QUEUE_CAPACITY, routeIncoming } from '../../src/use-cases/route-alerts.js';
import { createMemoryStore } from '../memory-store.js';

const MINUTE_MS = 60_000;
const RATE_LIMIT_MINUTES = 10;
const FOCUS_MINUTES = 30;
const OVERRUN_MINUTES = 5;
const NOW = new Date('2026-11-08T10:00:00.000Z');

const profile: Profile = {
  id: '00000000-0000-4000-8000-0000000000aa',
  name: 'Deep work',
  mutedApps: [],
  exceptions: [],
  muteNewApps: false,
};

function later(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * MINUTE_MS);
}

function alert(alertKey: string, type: AlertType = 'thermal'): Alert {
  return { alertKey, type, ts: NOW.toISOString(), params: { celsius: 95 } };
}

const empty = alert('battery-critical', 'battery-critical');
const thermal = alert('thermal:0');
const pressure = alert('system:cpu', 'pressure-incident');

describe('routeIncoming', () => {
  it('delivers every alert outside focus', async () => {
    const store = createMemoryStore();

    const result = await routeIncoming(store, { alerts: [empty, thermal, pressure] }, NOW);

    expect(RouteResult.parse(result)).toEqual({
      deliver: [empty, thermal, pressure],
      queued: 0,
      rateLimited: 0,
      summary: null,
    });
  });

  it('delivers an empty battery and queues the rest during focus', async () => {
    const store = createMemoryStore({ profiles: [profile] });
    await startFocus(store, { minutes: FOCUS_MINUTES }, NOW, 'UTC');

    const result = await routeIncoming(store, { alerts: [empty, thermal, pressure] }, later(1));

    expect(result).toEqual({ deliver: [empty], queued: 2, rateLimited: 0, summary: null });
    expect(await listQueue(store)).toEqual([
      { alert: thermal, queuedAt: later(1).toISOString() },
      { alert: pressure, queuedAt: later(1).toISOString() },
    ]);
  });

  it('lets one alert per key through every 10 min, across calls', async () => {
    const store = createMemoryStore();
    await routeIncoming(store, { alerts: [thermal] }, NOW);

    const again = await routeIncoming(store, { alerts: [thermal] }, later(RATE_LIMIT_MINUTES - 1));
    const afterWindow = await routeIncoming(
      store,
      { alerts: [thermal] },
      later(RATE_LIMIT_MINUTES),
    );

    expect(again).toMatchObject({ deliver: [], queued: 0, rateLimited: 1 });
    expect(afterWindow).toMatchObject({ deliver: [thermal], rateLimited: 0 });
  });

  it('forgets keys whose window is over', async () => {
    const store = createMemoryStore();
    await routeIncoming(store, { alerts: [thermal] }, NOW);

    await routeIncoming(store, { alerts: [] }, later(RATE_LIMIT_MINUTES + 1));

    expect(store.state().accepted).toEqual([]);
  });

  it('closes a session that ran out and returns its summary with the held alerts', async () => {
    const store = createMemoryStore({ profiles: [profile] });
    await startFocus(store, { minutes: FOCUS_MINUTES }, NOW, 'UTC');
    await routeIncoming(store, { alerts: [thermal] }, later(1));

    const result = await routeIncoming(
      store,
      { alerts: [pressure] },
      later(FOCUS_MINUTES + OVERRUN_MINUTES),
    );

    expect(result.deliver).toEqual([pressure]);
    expect(result.summary).toEqual({
      profileId: profile.id,
      startedAt: NOW.toISOString(),
      endedAt: later(FOCUS_MINUTES).toISOString(),
      alerts: [{ alert: thermal, queuedAt: later(1).toISOString() }],
    });
    expect(store.state().queue).toEqual([]);
  });

  it('keeps only the newest alerts once the queue is full', async () => {
    const store = createMemoryStore({ profiles: [profile] });
    await startFocus(store, { minutes: FOCUS_MINUTES }, NOW, 'UTC');
    const alerts = Array.from({ length: QUEUE_CAPACITY }, (_, i) => alert(`k${i}`));
    await routeIncoming(store, { alerts }, later(1));

    await routeIncoming(store, { alerts: [alert('newest')] }, later(2));

    const queue = await listQueue(store);
    expect(queue).toHaveLength(QUEUE_CAPACITY);
    expect(queue.at(0)?.alert.alertKey).toBe('k1');
    expect(queue.at(-1)?.alert.alertKey).toBe('newest');
  });
});
