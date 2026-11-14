import { NotFoundError } from '@deskpulse/service-kit/errors';
import { LIMITS } from '@deskpulse/shared/limits';
import type { App, AppUpdate } from '@deskpulse/shared/sessions';

import { reapplyCategories } from './reapply-categories.js';
import type { SessionsStore } from './store.js';

export function listApps(store: SessionsStore): Promise<App[]> {
  return store.transaction((tx) => tx.listApps(LIMITS.listSize));
}

/** Renames or recategorizes an app; a new category is applied to its last 30 days. */
export function updateApp(
  store: SessionsStore,
  id: string,
  update: AppUpdate,
  now: Date,
): Promise<App> {
  return store.transaction(async (tx) => {
    const app = await tx.updateApp(id, update);
    if (app === null) {
      throw new NotFoundError('App not found');
    }
    await reapplyCategories(tx, now);
    return app;
  });
}
