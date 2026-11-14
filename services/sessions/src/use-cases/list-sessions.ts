import type { TimeRangeQuery } from '@deskpulse/shared/common';
import { LIMITS } from '@deskpulse/shared/limits';
import type { Session } from '@deskpulse/shared/sessions';

import type { SessionsStore } from './store.js';

/** Sessions overlapping `[from, to)`, oldest first, the open one included. */
export function listSessions(store: SessionsStore, range: TimeRangeQuery): Promise<Session[]> {
  return store.transaction((tx) => tx.listSessions(range, LIMITS.exportSessions));
}
