import { createQueryBuilder } from '@deskpulse/service-kit/sql';
import { StoredLayout } from '@deskpulse/shared/layouts/layout';
import { LayoutPage } from '@deskpulse/shared/layouts/widget-catalog';
import { DEFAULT_PALETTE, Settings } from '@deskpulse/shared/settings';
import type { FastifyBaseLogger } from 'fastify';
import { type ColumnType, sql } from 'kysely';
import type { Pool } from 'pg';
import { z } from 'zod';

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
}

/**
 * What the settings row holds: the public settings plus `layouts`, one entry per page. Layouts
 * stay out of the public `Settings` schema, so `PUT /v1/settings` can neither send nor erase them.
 */
const StoredSettings = Settings.extend({
  layouts: z.partialRecord(LayoutPage, StoredLayout).optional(),
});

/**
 * The settings in the gateway's own schema. A value that no longer matches
 * the shared schema fails the read rather than reaching a caller as typed data.
 * Page layouts live in the same row under `layouts`, one key per page (SPEC §5 gateway).
 */
export function createSettingsStore(pool: Pool): SettingsStore {
  const db = createQueryBuilder<GatewayTables>(pool);
  const readStored = async (): Promise<z.infer<typeof StoredSettings> | undefined> => {
    const row = await db
      .selectFrom('settings')
      .select('value')
      .where('id', '=', true)
      .executeTakeFirst();
    return row === undefined ? undefined : StoredSettings.parse(row.value);
  };
  const read = async (): Promise<Settings> => {
    const stored = await readStored();
    if (stored === undefined) {
      return DEFAULT_SETTINGS;
    }
    const { layouts: _layouts, ...settings } = stored;
    return settings;
  };
  return {
    read,
    async write(settings): Promise<Settings> {
      const value = JSON.stringify(Settings.parse(settings));
      // The saved layouts are carried over from the existing row, in the same statement.
      await db
        .insertInto('settings')
        .values({ id: true, value })
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            value: sql`${value}::jsonb || CASE WHEN settings.value ? 'layouts'
              THEN jsonb_build_object('layouts', settings.value -> 'layouts') ELSE '{}'::jsonb END`,
          }),
        )
        .execute();
      return read();
    },
    async readLayout(page): Promise<StoredLayout | null> {
      return (await readStored())?.layouts?.[page] ?? null;
    },
    async writeLayout(page, layout): Promise<void> {
      const layouts = JSON.stringify({ [page]: StoredLayout.parse(layout) });
      const fresh = JSON.stringify({ ...DEFAULT_SETTINGS, layouts: JSON.parse(layouts) });
      await db
        .insertInto('settings')
        .values({ id: true, value: fresh })
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            value: sql`jsonb_set(settings.value, '{layouts}',
              coalesce(settings.value -> 'layouts', '{}'::jsonb) || ${layouts}::jsonb)`,
          }),
        )
        .execute();
    },
    async deleteLayout(page): Promise<void> {
      await db
        .updateTable('settings')
        .set({ value: sql`value #- ARRAY['layouts', ${page}]` })
        .where('id', '=', true)
        .execute();
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
