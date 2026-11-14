import { createQueryBuilder } from '@deskpulse/service-kit/sql';
import { StoredLayout } from '@deskpulse/shared/layouts/layout';
import type { LayoutPage } from '@deskpulse/shared/layouts/widget-catalog';
import { DEFAULT_PALETTE, Settings } from '@deskpulse/shared/settings';
import type { FastifyBaseLogger } from 'fastify';
import type { ColumnType } from 'kysely';
import type { Pool } from 'pg';

/** SPEC §4.1 load thresholds: `some avg10` percent that opens a memory, cpu or io incident. */
const DEFAULT_THRESHOLDS = { memory: 10, cpu: 40, io: 30 };

/**
 * What a fresh install runs with, before the user changes anything. Hebrew is
 * the default language (CLAUDE.md).
 */
export const DEFAULT_SETTINGS: Settings = {
  language: 'he',
  theme: 'system',
  palette: DEFAULT_PALETTE,
  privacy: { excludedApps: [] },
  thresholds: DEFAULT_THRESHOLDS,
  systemApps: [],
  quietHours: { enabled: false },
};

/** `gateway.settings`, the only data the gateway owns (SPEC §5 gateway). */
export interface SettingsStore {
  /** The stored settings, or the defaults when none were saved yet. */
  read(): Promise<Settings>;
  /** Replaces all settings and returns what is now stored. */
  write(settings: Settings): Promise<Settings>;
  /**
   * The saved layout of a page exactly as stored (widgets not yet vetted), or `null` when the
   * user never arranged it.
   */
  readLayout(page: LayoutPage): Promise<StoredLayout | null>;
  /** Replaces a page's layout. */
  writeLayout(page: LayoutPage, layout: StoredLayout): Promise<void>;
  /** Forgets a page's layout, so it falls back to the default. A page with none is fine. */
  deleteLayout(page: LayoutPage): Promise<void>;
}

/** `jsonb` written as serialized JSON text; read back as the parsed value. */
type Json = ColumnType<unknown, string, string>;

interface GatewayTables {
  settings: { id: boolean; value: Json };
  layouts: { page: string; value: Json };
}

/**
 * The settings in the gateway's own schema. A value that no longer matches
 * the shared schema fails the read rather than reaching a caller as typed data.
 */
export function createSettingsStore(pool: Pool): SettingsStore {
  const db = createQueryBuilder<GatewayTables>(pool);
  const read = async (): Promise<Settings> => {
    const row = await db
      .selectFrom('settings')
      .select('value')
      .where('id', '=', true)
      .executeTakeFirst();
    return row === undefined ? DEFAULT_SETTINGS : Settings.parse(row.value);
  };
  return {
    read,
    async write(settings): Promise<Settings> {
      const value = JSON.stringify(Settings.parse(settings));
      await db
        .insertInto('settings')
        .values({ id: true, value })
        .onConflict((conflict) => conflict.column('id').doUpdateSet({ value }))
        .execute();
      return read();
    },
    async readLayout(page): Promise<StoredLayout | null> {
      const row = await db
        .selectFrom('layouts')
        .select('value')
        .where('page', '=', page)
        .executeTakeFirst();
      return row === undefined ? null : StoredLayout.parse(row.value);
    },
    async writeLayout(page, layout): Promise<void> {
      const value = JSON.stringify(StoredLayout.parse(layout));
      await db
        .insertInto('layouts')
        .values({ page, value })
        .onConflict((conflict) => conflict.column('page').doUpdateSet({ value }))
        .execute();
    },
    async deleteLayout(page): Promise<void> {
      await db.deleteFrom('layouts').where('page', '=', page).execute();
    },
  };
}

/**
 * The settings, or the defaults when they cannot be read. For callers that
 * must not fail because of a settings problem (a batch is still stored, a
 * focus still starts); the failure is logged.
 */
export async function readSettingsOrDefaults(
  store: SettingsStore,
  log: FastifyBaseLogger,
): Promise<Settings> {
  try {
    return await store.read();
  } catch (error: unknown) {
    log.warn({ err: error }, 'settings unreadable; used the defaults');
    return DEFAULT_SETTINGS;
  }
}
