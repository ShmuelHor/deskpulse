import { createQueryBuilder, inTransaction } from '@deskpulse/service-kit/sql';
import type { Kysely, PostgresPool } from 'kysely';

import type { SessionsStore, SessionsTransaction } from '../use-cases/store.js';
import * as apps from './apps-table.js';
import type { SessionsDatabase } from './database.js';
import * as sessions from './sessions-table.js';

function bind(db: Kysely<SessionsDatabase>): SessionsTransaction {
  return {
    lockOpenSession: () => sessions.lockOpenSession(db),
    recordedUntil: () => sessions.recordedUntil(db),
    setRecordedUntil: (tsMs) => sessions.setRecordedUntil(db, tsMs),
    saveSpans: (spans) => sessions.saveSpans(db, spans),
    closedSpansOverlapping: (fromMs, toMs, limit) =>
      sessions.closedSpansOverlapping(db, fromMs, toMs, limit),
    listSessions: (range, limit) => sessions.listSessions(db, range, limit),
    ensureApps: (ids) => apps.ensureApps(db, ids),
    listApps: (limit) => apps.listApps(db, limit),
    updateApp: (id, update) => apps.updateApp(db, id, update),
  };
}

/** The sessions store on Postgres. Kysely sends every value as a bind parameter (SECURITY A8). */
export function createPgStore(pool: PostgresPool): SessionsStore {
  const db = createQueryBuilder<SessionsDatabase>(pool);
  return {
    transaction: (work) => inTransaction(db, (trx) => work(bind(trx))),
  };
}
