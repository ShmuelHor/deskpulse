import { describe, expect, it } from 'vitest';

import { type CountedSession, rollUp } from '../../src/domain/rollup.js';

const JERUSALEM = 'Asia/Jerusalem';

function session(appId: string, start: string, end: string): CountedSession {
  return { appId, startMs: Date.parse(start), endMs: Date.parse(end) };
}

function between(start: string, end: string): number {
  return Date.parse(end) - Date.parse(start);
}

describe('rollUp', () => {
  it('splits a session that crosses local midnight between the two days', () => {
    // 23:40 to 00:25 in Jerusalem (UTC+2): 20 minutes on the 8th, 25 on the 9th.
    const start = '2026-11-08T21:40:00.000Z';
    const localMidnight = '2026-11-08T22:00:00.000Z';
    const end = '2026-11-08T22:25:00.000Z';

    const entries = rollUp([session('code', start, end)], JERUSALEM);

    expect(entries).toEqual([
      { date: '2026-11-08', appId: 'code', ms: between(start, localMidnight) },
      { date: '2026-11-09', appId: 'code', ms: between(localMidnight, end) },
    ]);
  });

  it('uses the configured zone, not UTC, for the day', () => {
    // 22:30 UTC on the 8th is already the 9th in Jerusalem.
    const afterLocalMidnight = session(
      'code',
      '2026-11-08T22:30:00.000Z',
      '2026-11-08T22:40:00.000Z',
    );

    expect(rollUp([afterLocalMidnight], JERUSALEM).map((entry) => entry.date)).toEqual([
      '2026-11-09',
    ]);
    expect(rollUp([afterLocalMidnight], 'UTC').map((entry) => entry.date)).toEqual(['2026-11-08']);
  });

  it('adds up sessions of the same day and app, and keeps the rest apart', () => {
    const sessions = [
      session('code', '2026-11-08T08:00:00.000Z', '2026-11-08T08:10:00.000Z'),
      session('firefox', '2026-11-08T08:10:00.000Z', '2026-11-08T08:15:00.000Z'),
      session('code', '2026-11-08T08:15:00.000Z', '2026-11-08T08:45:00.000Z'),
      session('code', '2026-11-09T09:00:00.000Z', '2026-11-09T09:05:00.000Z'),
    ];

    expect(rollUp(sessions, JERUSALEM)).toEqual([
      {
        date: '2026-11-08',
        appId: 'code',
        ms: between('2026-11-08T08:00:00.000Z', '2026-11-08T08:40:00.000Z'),
      },
      {
        date: '2026-11-08',
        appId: 'firefox',
        ms: between('2026-11-08T08:10:00.000Z', '2026-11-08T08:15:00.000Z'),
      },
      {
        date: '2026-11-09',
        appId: 'code',
        ms: between('2026-11-09T09:00:00.000Z', '2026-11-09T09:05:00.000Z'),
      },
    ]);
  });

  it('counts nothing for a session with no length', () => {
    const instant = session('code', '2026-11-08T08:00:00.000Z', '2026-11-08T08:00:00.000Z');

    expect(rollUp([instant], JERUSALEM)).toEqual([]);
  });
});
