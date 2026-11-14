import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool } from '@deskpulse/service-kit/database';
import { runMigrations } from '@deskpulse/service-kit/migrations';
import { DEFAULT_PALETTE } from '@deskpulse/shared/settings';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type DisposablePostgres,
  dockerAvailable,
  startPostgres,
} from '../../../../tests/security/lib/disposable-postgres.js';
import { MIGRATIONS_DIR } from '../../src/core/database.js';
import { createSettingsStore, DEFAULT_SETTINGS } from '../../src/core/settings-store.js';

const STARTUP_TIMEOUT_MS = 240_000;
const EARLIER_MIGRATIONS = [
  '1762588800000_create-settings.sql',
  '1762588800001_drop-store-titles-setting.sql',
];
const { palette: _palette, ...SETTINGS_BEFORE_PALETTE } = {
  ...DEFAULT_SETTINGS,
  language: 'en',
  theme: 'dark',
};

const available = await dockerAvailable();

/**
 * The upgrade of a live install (T68): its stored settings have no `palette`, which the strict
 * Settings schema requires. Runs on a throwaway Postgres container that is removed afterwards.
 */
describe.skipIf(!available)('gateway migration for the palette', () => {
  let postgres: DisposablePostgres | undefined;
  let before: string | undefined;

  beforeAll(async () => {
    postgres = await startPostgres();
    before = await mkdtemp(join(tmpdir(), 'deskpulse-gw-migrations-'));
    for (const file of EARLIER_MIGRATIONS) {
      await cp(join(MIGRATIONS_DIR, file), join(before, file));
    }
  }, STARTUP_TIMEOUT_MS);

  afterAll(async () => {
    if (before !== undefined) {
      await rm(before, { recursive: true, force: true });
    }
    await postgres?.stop();
  }, STARTUP_TIMEOUT_MS);

  it('gives an existing settings row the default palette, and migrating twice is harmless', async () => {
    if (postgres === undefined || before === undefined) {
      throw new Error('The database did not start');
    }
    const pool = createPool(
      {
        host: postgres.host,
        port: postgres.port,
        database: 'postgres',
        user: 'gateway',
        schema: 'gateway',
        password: postgres.passwords.gateway,
      },
      'gateway-migration-test',
    );
    try {
      const log = pino({ level: 'silent' });
      const options = { schema: 'gateway' };
      await runMigrations(pool, { ...options, dir: before }, log);
      await pool.query('INSERT INTO settings (id, value) VALUES (true, $1)', [
        JSON.stringify(SETTINGS_BEFORE_PALETTE),
      ]);
      const store = createSettingsStore(pool);
      await expect(store.read()).rejects.toThrow();

      await runMigrations(pool, { ...options, dir: MIGRATIONS_DIR }, log);
      await runMigrations(pool, { ...options, dir: MIGRATIONS_DIR }, log);

      expect(await store.read()).toEqual({
        ...SETTINGS_BEFORE_PALETTE,
        palette: DEFAULT_PALETTE,
      });
      expect(await store.readLayout('control')).toBeNull();
    } finally {
      await pool.end();
    }
  });

  it('keeps a palette the user already chose', async () => {
    if (postgres === undefined) {
      throw new Error('The database did not start');
    }
    const pool = createPool(
      {
        host: postgres.host,
        port: postgres.port,
        database: 'postgres',
        user: 'gateway',
        schema: 'gateway',
        password: postgres.passwords.gateway,
      },
      'gateway-migration-test-2',
    );
    try {
      await pool.query('UPDATE settings SET value = value || $1::jsonb', ['{"palette":"navy"}']);
      await runMigrations(
        pool,
        { schema: 'gateway', dir: MIGRATIONS_DIR },
        pino({ level: 'silent' }),
      );

      expect((await createSettingsStore(pool).read()).palette).toBe('navy');
    } finally {
      await pool.end();
    }
  });
});
