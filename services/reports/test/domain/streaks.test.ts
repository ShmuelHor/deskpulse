import { describe, expect, it } from 'vitest';

import type { CountedSession } from '../../src/domain/rollup.js';
import { MAX_INTERRUPTION_MS, mergeStreaks, type StoredStreak } from '../../src/domain/streaks.js';

const STORED_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';

/** A wall-clock time on 2026-11-08, UTC. */
function at(clock: string): number {
  return Date.parse(`2026-11-08T${clock}.000Z`);
}

function session(from: string, to: string): CountedSession {
  return { appId: 'code', startMs: at(from), endMs: at(to) };
}

function stored(id: string, from: string, to: string): StoredStreak {
  return { id, startMs: at(from), endMs: at(to) };
}

function streak(from: string, to: string): object {
  return { id: null, startMs: at(from), endMs: at(to) };
}

describe('mergeStreaks', () => {
  it('joins back-to-back sessions of into one streak', () => {
    const sessions = [session('08:00:00', '08:20:00'), session('08:20:00', '08:50:00')];

    expect(mergeStreaks([], sessions)).toEqual({
      removed: [],
      added: [streak('08:00:00', '08:50:00')],
    });
  });

  it('lets a short gap pass, and breaks on a longer interruption', () => {
    expect(MAX_INTERRUPTION_MS).toBe(at('08:21:00') - at('08:20:00'));
    const sessions = [
      session('08:00:00', '08:20:00'),
      session('08:21:00', '08:40:00'),
      session('08:41:01', '09:00:00'),
    ];

    expect(mergeStreaks([], sessions).added).toEqual([
      streak('08:00:00', '08:40:00'),
      streak('08:41:01', '09:00:00'),
    ]);
  });

  it('extends a stored streak and joins two stored ones the new session bridges', () => {
    const before = stored(STORED_ID, '08:00:00', '08:30:00');
    const after = stored(OTHER_ID, '08:40:00', '09:00:00');

    const changes = mergeStreaks([before, after], [session('08:30:00', '08:40:00')]);

    expect(changes).toEqual({
      removed: [STORED_ID, OTHER_ID],
      added: [streak('08:00:00', '09:00:00')],
    });
  });

  it('changes nothing when a retried session falls inside a stored streak', () => {
    const changes = mergeStreaks(
      [stored(STORED_ID, '08:00:00', '09:00:00')],
      [session('08:10:00', '08:20:00')],
    );

    expect(changes).toEqual({ removed: [], added: [] });
  });

  it('gives the same streaks whatever order the sessions arrive in', () => {
    const sessions = [
      session('08:30:00', '08:40:00'),
      session('08:00:00', '08:30:00'),
      session('08:40:00', '08:50:00'),
    ];

    expect(mergeStreaks([], sessions)).toEqual(mergeStreaks([], [...sessions].reverse()));
  });
});
