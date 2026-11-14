import type { WindowSample } from '@deskpulse/shared/ingest';
import { LIMITS } from '@deskpulse/shared/limits';
import { describe, expect, it } from 'vitest';

import { SampleResult } from '../../src/contracts.js';
import { recordSamples } from '../../src/use-cases/record-samples.js';
import { createMemoryStore } from '../memory-store.js';

const PID = 4242;

function window(clock: string, wmClass: string, title?: string): WindowSample {
  return {
    kind: 'window',
    ts: `2026-11-08T${clock}.000Z`,
    wmClass,
    pid: PID,
    locked: false,
    ...(title === undefined ? {} : { title }),
  };
}

describe('recordSamples', () => {
  it('returns the sessions a batch closed', async () => {
    const store = createMemoryStore();

    const batch = [
      window('09:00:00', 'code', 'merge.ts'),
      window('09:00:05', 'code'),
      window('09:00:10', 'firefox'),
    ];

    const result = await recordSamples(store, batch);

    expect(result.accepted).toBe(batch.length);
    expect(result.closed).toEqual([
      {
        id: expect.any(String),
        appId: 'code',
        start: '2026-11-08T09:00:00.000Z',
        end: '2026-11-08T09:00:10.000Z',
        title: 'merge.ts',
      },
    ]);
  });

  it('continues the open session across batches and registers new apps', async () => {
    const store = createMemoryStore();

    await recordSamples(store, [window('09:00:00', 'code'), window('09:00:05', 'code')]);
    const second = await recordSamples(store, [window('09:00:10', 'code')]);

    expect(second.closed).toEqual([]);
    const [session] = store.state().sessions;
    expect(store.state().sessions).toHaveLength(1);
    expect(session).toMatchObject({
      startMs: Date.parse('2026-11-08T09:00:00.000Z'),
      closed: false,
    });
    expect(store.state().apps).toEqual([{ id: 'code', name: 'code', icon: null }]);
  });

  it('closes the stored session when the next batch comes after a gap', async () => {
    const store = createMemoryStore();
    await recordSamples(store, [window('09:00:00', 'code')]);

    const result = await recordSamples(store, [window('09:10:00', 'code')]);

    expect(result.closed.map((closed) => closed.end)).toEqual(['2026-11-08T09:00:00.000Z']);
    expect(store.state().sessions.filter((session) => !session.closed)).toHaveLength(1);
  });

  it('reports samples the stored session already covers as late', async () => {
    const store = createMemoryStore();
    await recordSamples(store, [window('09:00:00', 'code'), window('09:00:10', 'code')]);

    const result = await recordSamples(store, [window('09:00:05', 'firefox')]);

    expect(result).toEqual({ accepted: 0, late: 1, closed: [] });
  });

  it('records nothing twice when a closing batch is sent again', async () => {
    const store = createMemoryStore();
    const batch = [
      window('09:00:00', 'code'),
      window('09:00:05', 'code'),
      window('09:00:10', 'firefox'),
    ];
    await recordSamples(store, batch);
    const before = store.state().sessions;

    const retry = await recordSamples(store, [window('09:00:20', 'firefox', 'x'), ...batch]);
    const again = await recordSamples(store, batch);

    // A retry hands back the session the first attempt closed (see the next suite).
    const codeId = store.state().sessions.find((session) => session.appId === 'code')?.id;
    expect(retry).toMatchObject({ accepted: 1, late: batch.length });
    expect(again.accepted).toBe(0);
    expect(again.closed.map((session) => session.id)).toEqual([codeId]);
    expect(store.state().sessions).toHaveLength(before.length);
    expect(store.state().sessions.filter((session) => session.appId === 'code')).toHaveLength(1);
  });
});

describe('recordSamples on a retried batch', () => {
  const batch = [
    window('09:00:00', 'code'),
    window('09:00:05', 'code'),
    window('09:00:10', 'firefox'),
  ];

  it('returns the sessions the first attempt closed, with the same ids', async () => {
    const store = createMemoryStore();
    const first = await recordSamples(store, batch);

    const retry = await recordSamples(store, batch);

    expect(retry.accepted).toBe(0);
    expect(retry.closed).toEqual(first.closed);
  });

  it('does not return sessions unrelated to the retried samples', async () => {
    const store = createMemoryStore();
    await recordSamples(store, batch);
    await recordSamples(store, [window('10:00:00', 'code'), window('10:00:10', 'firefox')]);

    const retry = await recordSamples(store, batch);

    expect(retry.closed.map((session) => session.start)).not.toContain('2026-11-08T10:00:00.000Z');
  });
});

const EXTRA = 5;
const ID_DIGITS = 12;

describe('recordSamples replay cap', () => {
  it('never returns more closed sessions than a reply may hold', async () => {
    const store = createMemoryStore();
    const first = [window('09:00:00', 'code'), window('09:00:10', 'firefox')];
    await recordSamples(store, first);
    const crowd = Array.from({ length: LIMITS.ingestSamples + EXTRA }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(ID_DIGITS, '0')}`,
      appId: 'crowd',
      startMs: Date.parse('2026-11-08T09:00:01.000Z'),
      endMs: Date.parse('2026-11-08T09:00:02.000Z'),
      title: null,
      closed: true,
    }));
    const crowded = createMemoryStore({ sessions: [...store.state().sessions, ...crowd] });

    const retry = await recordSamples(crowded, first);

    expect(retry.closed).toHaveLength(LIMITS.ingestSamples);
    expect(SampleResult.safeParse(retry).success).toBe(true);
  });
});
