import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool } from '@deskpulse/service-kit/database';
import { runMigrations } from '@deskpulse/service-kit/migrations';
import { Settings } from '@deskpulse/shared/settings';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MIGRATIONS_DIR } from '../../apps/gateway/src/core/database.js';
import { createSettingsStore } from '../../apps/gateway/src/core/settings-store.js';
import {
  type DisposablePostgres,
  dockerAvailable,
  startPostgres,
} from './lib/disposable-postgres.js';

const STARTUP_TIMEOUT_MS = 240_000;
const FIRST_MIGRATION = '1762588800000_create-settings.sql';
const OLD_SETTINGS = {
  language: 'en',
  theme: 'dark',
  privacy: { storeTitles: true, excludedApps: ['keepassxc'] },
  thresholds: { memory: 10, cpu: 40, io: 30 },
  systemApps: [],
  quietHours: { enabled: false },
};

const available = await dockerAvailable();

/**
 * The upgrade of a live install (T62): its stored settings still carry the removed
 * `privacy.storeTitles`, which the strict Settings schema would reject. Runs on a throwaway
 * Postgres container that is removed afterwards.
 */
describe.skipIf(!available)('gateway settings migration', () => {
  let postgres: DisposablePostgres | undefined;
  let before: string | undefined;

  beforeAll(async () => {
    postgres = await startPostgres();
    before = await mkdtemp(join(tmpdir(), 'deskpulse-gw-migrations-'));
    await cp(join(MIGRATIONS_DIR, FIRST_MIGRATION), join(before, FIRST_MIGRATION));
  }, STARTUP_TIMEOUT_MS);

  afterAll(async () => {
    if (before !== undefined) {
      await rm(before, { recursive: true, force: true });
    }
    await postgres?.stop();
  }, STARTUP_TIMEOUT_MS);

  it('reads a settings row in the old shape after migrating, and migrating twice is harmless', async () => {
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
        JSON.stringify(OLD_SETTINGS),
      ]);
      const store = createSettingsStore(pool);
      await expect(store.read()).rejects.toThrow();

      await runMigrations(pool, { ...options, dir: MIGRATIONS_DIR }, log);
      await runMigrations(pool, { ...options, dir: MIGRATIONS_DIR }, log);

      const { privacy, ...rest } = OLD_SETTINGS;
      expect(await store.read()).toEqual(
        Settings.parse({ ...rest, privacy: { excludedApps: privacy.excludedApps } }),
      );
    } finally {
      await pool.end();
    }
  });
});
