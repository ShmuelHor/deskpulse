import { parseRow, parseRows, toPgText } from '@deskpulse/service-kit/sql';
import type { TimeRangeQuery } from '@deskpulse/shared/common';
import type { Session } from '@deskpulse/shared/sessions';
import { type Kysely, sql } from 'kysely';
import { z } from 'zod';

import type { Span } from '../domain/merge-samples.js';
import type { StoredSpan } from '../use-cases/store.js';
import type { SessionsDatabase } from './database.js';

type Db = Kysely<SessionsDatabase>;

const SessionRow = z.object({
  id: z.string(),
  app_id: z.string(),
  start_at: z.date(),
  end_at: z.date(),
  title: z.string().nullable(),
});
type SessionRow = z.infer<typeof SessionRow>;

const IdRow = z.object({ id: z.string() });
const SESSION_COLUMNS = ['id', 'app_id', 'start_at', 'end_at', 'title'] as const;
const WatermarkRow = z.object({ recorded_until: z.date() });

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    appId: row.app_id,
    start: row.start_at.toISOString(),
    end: row.end_at.toISOString(),
    ...(row.title === null ? {} : { title: row.title }),
  };
}

/**
 * Blocks other batches (not readers) until the transaction ends, so the open
 * session is continued by one batch at a time and never duplicated.
 */
export async function lockOpenSession(db: Db): Promise<Span | null> {
  await sql`LOCK TABLE sessions IN SHARE ROW EXCLUSIVE MODE`.execute(db);
  const row = parseRow(
    SessionRow,
    await db
      .selectFrom('sessions')
      .select(SESSION_COLUMNS)
      .where('closed', '=', false)
      .executeTakeFirst(),
  );
  if (row === null) {
    return null;
  }
  return {
    id: row.id,
    appId: row.app_id,
    startMs: row.start_at.getTime(),
    endMs: row.end_at.getTime(),
    title: row.title,
    closed: false,
  };
}

export async function recordedUntil(db: Db): Promise<number | null> {
  const row = parseRow(
    WatermarkRow,
    await db.selectFrom('sample_watermark').select('recorded_until').executeTakeFirst(),
  );
  return row === null ? null : row.recorded_until.getTime();
}

export async function setRecordedUntil(db: Db, tsMs: number): Promise<void> {
  await db
    .insertInto('sample_watermark')
    .values({ recorded_until: new Date(tsMs) })
    .onConflict((conflict) =>
      conflict
        .column('id')
        .doUpdateSet((eb) => ({ recorded_until: eb.ref('excluded.recorded_until') })),
    )
    .execute();
}

async function insertSpan(db: Db, span: Span): Promise<string> {
  const row = parseRow(
    IdRow,
    await db
      .insertInto('sessions')
      .values({
        app_id: span.appId,
        start_at: new Date(span.startMs),
        end_at: new Date(span.endMs),
        title: span.title,
        closed: span.closed,
      })
      .returning('id')
      .executeTakeFirst(),
  );
  if (row === null) {
    throw new Error('INSERT returned no row');
  }
  return row.id;
}

async function updateSpan(db: Db, id: string, span: Span): Promise<void> {
  await db
    .updateTable('sessions')
    .set({
      end_at: new Date(span.endMs),
      title: span.title,
      closed: span.closed,
    })
    .where('id', '=', id)
    .execute();
}

/**
 * In order: a closed span must be written before the next one opens (one open
 * at most). The result holds the title as stored, so the reply matches the row.
 */
export async function saveSpans(db: Db, spans: readonly Span[]): Promise<StoredSpan[]> {
  const saved: StoredSpan[] = [];
  for (const original of spans) {
    const span = { ...original, title: toPgText(original.title) };
    if (span.id === null) {
      saved.push({ ...span, id: await insertSpan(db, span) });
    } else {
      await updateSpan(db, span.id, span);
      saved.push({ ...span, id: span.id });
    }
  }
  return saved;
}

/** Sessions overlapping `[from, to)`. An open session counts up to its last sample. */
export async function listSessions(
  db: Db,
  range: TimeRangeQuery,
  limit: number,
): Promise<Session[]> {
  const rows = parseRows(
    SessionRow,
    await db
      .selectFrom('sessions')
      .select(SESSION_COLUMNS)
      .where('start_at', '<', new Date(range.to))
      .where('end_at', '>=', new Date(range.from))
      .orderBy('start_at')
      .orderBy('id')
      .limit(limit)
      .execute(),
  );
  return rows.map(toSession);
}

/** Closed sessions overlapping `[fromMs, toMs]`, for a retried batch (see `SessionsTransaction`). */
export async function closedSpansOverlapping(
  db: Db,
  fromMs: number,
  toMs: number,
  limit: number,
): Promise<StoredSpan[]> {
  const rows = parseRows(
    SessionRow,
    await db
      .selectFrom('sessions')
      .select(SESSION_COLUMNS)
      .where('closed', '=', true)
      .where('start_at', '<=', new Date(toMs))
      .where('end_at', '>=', new Date(fromMs))
      .orderBy('start_at')
      .orderBy('id')
      .limit(limit)
      .execute(),
  );
  return rows.map((row) => ({
    id: row.id,
    appId: row.app_id,
    startMs: row.start_at.getTime(),
    endMs: row.end_at.getTime(),
    title: row.title,
    closed: true,
  }));
}
