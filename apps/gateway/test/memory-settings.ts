import type { StoredLayout } from '@deskpulse/shared/layouts/layout';
import type { Settings } from '@deskpulse/shared/settings';

import { DEFAULT_SETTINGS, type SettingsStore } from '../src/core/settings-store.js';

/** `gateway.settings` without a database: what the last write stored. */
export function memorySettings(initial = DEFAULT_SETTINGS): SettingsStore {
  let stored = initial;
  const layouts = new Map<string, StoredLayout>();
  return {
    read: () => Promise.resolve(stored),
    write: (settings): Promise<Settings> => {
      stored = settings;
      return Promise.resolve(stored);
    },
    readLayout: (page) => Promise.resolve(layouts.get(page) ?? null),
    writeLayout: (page, layout): Promise<void> => {
      layouts.set(page, layout);
      return Promise.resolve();
    },
    deleteLayout: (page): Promise<void> => {
      layouts.delete(page);
      return Promise.resolve();
    },
  };
}
