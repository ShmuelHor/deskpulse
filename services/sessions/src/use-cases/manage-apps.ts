import { NotFoundError } from '@deskpulse/service-kit/errors';
import { LIMITS } from '@deskpulse/shared/limits';
import type { App, AppUpdate } from '@deskpulse/shared/sessions';

import type { SessionsStore } from './store.js';

export function listApps(store: SessionsStore): Promise<App[]> {
  return store.transaction((tx) => tx.listApps(LIMITS.listSize));
}

/** Renames an app. */
export function updateApp(store: SessionsStore, id: string, update: AppUpdate): Promise<App> {
  return store.transaction(async (tx) => {
    const app = await tx.updateApp(id, update);
    if (app === null) {
      throw new NotFoundError('App not found');
    }
    return app;
  });
}
