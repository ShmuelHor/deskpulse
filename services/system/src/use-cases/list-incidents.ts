import type { TimeRangeQuery } from '@deskpulse/shared/common';
import { LIMITS } from '@deskpulse/shared/limits';
import type { Incident } from '@deskpulse/shared/system';

import type { SystemStore } from './store.js';

/** Incidents overlapping `[from, to)`, oldest first, open ones included. */
export function listIncidents(store: SystemStore, range: TimeRangeQuery): Promise<Incident[]> {
  return store.transaction((tx) => tx.listIncidents(range, LIMITS.listSize));
}
