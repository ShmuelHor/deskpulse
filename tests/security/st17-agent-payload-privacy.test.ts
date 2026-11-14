import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool } from '@deskpulse/service-kit/database';
import { runMigrations } from '@deskpulse/service-kit/migrations';
import { ProcessSample, WindowSample } from '@deskpulse/shared/ingest';
import { Settings } from '@deskpulse/shared/settings';
import pino from 'pino';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPressureCollector } from '../../apps/agent/src/collectors/pressure/collector.js';
import { createWindowCollector } from '../../apps/agent/src/collectors/window/collector.js';
import { createLogger } from '../../apps/agent/src/core/logger.js';
import type { CollectorContext } from '../../apps/agent/src/core/plugin.js';
import { type SessionBus, SessionBusError } from '../../apps/agent/src/core/session-bus.js';
import { MIGRATIONS_DIR } from '../../apps/gateway/src/core/database.js';
import { createSettingsStore } from '../../apps/gateway/src/core/settings-store.js';
import {
  type DisposablePostgres,
  dockerAvailable,
  startPostgres,
} from './lib/disposable-postgres.js';

// Distinctive markers, so a match can only mean a leak. Built at runtime and
// low-entropy, so gitleaks never sees a token-shaped literal (ST02).
const CMDLINE_MARKER = ['st17', 'cmdline', 'marker'].join('-');
const ENVIRON_MARKER = ['st17', 'environ', 'marker'].join('-');
const COMM = 'st17-worker';
const PIDS = ['101', '202'];

const PRESSURE_UNDER_LOAD = [
  'some avg10=95.00 avg60=90.00 avg300=50.00 total=1',
  'full avg10=50.00 avg60=40.00 avg300=20.00 total=1',
  '',
].join('\n');

/** A `/proc/<pid>/stat` line with some CPU time, so the process ranks. */
function stat(pid: string): string {
  return `${pid} (${COMM}) R 1 1 1 0 -1 4194304 1 0 0 0 5000 0 0 0 20 0 1 0 0 1 64 18446744073709551615 1 1 0 0 0 0 0 0 0 0 0 0 17 0 0 0 0 0 0\n`;
}

/** A loaded `/proc` look-alike whose processes carry secrets in their arguments and environment. */
async function procTree(root: string): Promise<void> {
  await mkdir(join(root, 'pressure'));
  await Promise.all(
    ['cpu', 'memory', 'io'].map((resource) =>
      writeFile(join(root, 'pressure', resource), PRESSURE_UNDER_LOAD),
    ),
  );
  await writeFile(
    join(root, 'meminfo'),
    'MemTotal: 1000 kB\nMemAvailable: 500 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n',
  );
  await writeFile(join(root, 'uptime'), '1000.00 0.00\n');
  for (const pid of PIDS) {
    const dir = join(root, pid);
    await mkdir(dir);
    await writeFile(join(dir, 'stat'), stat(pid));
    await writeFile(join(dir, 'io'), 'read_bytes: 4096\nwrite_bytes: 4096\n');
    await writeFile(join(dir, 'status'), `Name:\t${COMM}\nVmRSS:\t256 kB\n`);
    await writeFile(join(dir, 'cmdline'), `/usr/bin/${COMM}\0--flag=${CMDLINE_MARKER}\0`);
    await writeFile(join(dir, 'environ'), `DESKPULSE_ST17=${ENVIRON_MARKER}\0`);
  }
}

function context(): CollectorContext {
  const unavailable = (): Promise<never> =>
    Promise.reject(new SessionBusError('UNAVAILABLE', 'no session bus in ST17'));
  return {
    logger: createLogger({ level: 'silent' }),
    sessionBus: { call: unavailable, subscribe: unavailable, close: (): void => undefined },
    presence: { locked: false },
    reportPresence: (): void => undefined,
    emit: (): Promise<void> => Promise.resolve(),
    reportKnownApps: (): void => undefined,
  };
}

/** One poll of the process collector, serialized the way the buffer stores it. */
async function collectPayload(root: string): Promise<string> {
  const collector = createPressureCollector({ root });
  if (collector.collect === undefined) {
    throw new Error('the pressure collector polls');
  }
  const samples = await collector.collect(context());
  expect(samples.map((sample) => sample.kind)).toEqual(['pressure', 'processes']);
  return JSON.stringify(samples);
}

describe('ST17 agent payload privacy', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'deskpulse-st17-'));
    await procTree(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('the agent never sends a process cmdline', async () => {
    // Act
    const payload = await collectPayload(root);

    // Assert: the processes are there, named by comm, with no trace of their arguments.
    expect(payload).toContain(`"comm":"${COMM}"`);
    expect(payload).not.toContain(CMDLINE_MARKER);
    expect(payload).not.toContain(ENVIRON_MARKER);
    expect(payload).not.toContain('/usr/bin/');
    expect(payload).not.toMatch(/cmdline|environ|args/i);
  });

  it('the agent never opens a process cmdline or environ', async () => {
    // Arrange: as directories, any read of them throws EISDIR and fails the poll.
    for (const pid of PIDS) {
      for (const file of ['cmdline', 'environ']) {
        await rm(join(root, pid, file));
        await mkdir(join(root, pid, file));
      }
    }

    // Act / Assert
    await expect(collectPayload(root)).resolves.toContain(`"comm":"${COMM}"`);
  });

  it('the ingest contract rejects a process that carries a cmdline', () => {
    // Arrange
    const sample = {
      kind: 'processes',
      ts: '2026-11-09T08:00:00.000Z',
      processes: [
        {
          pid: 101,
          comm: COMM,
          cpuPct: 1,
          rssBytes: 1,
          ioBytesPerSec: 0,
          cmdline: `/usr/bin/${COMM} --flag=${CMDLINE_MARKER}`,
        },
      ],
    };

    // Act / Assert
    expect(ProcessSample.safeParse(sample).success).toBe(false);
  });

  it('[T62] the window collector never sends a window title', async () => {
    // Arrange: the extension replies with a secret title for the focused window.
    const title = ['st17', 'window', 'title', 'marker'].join('-');
    const list = JSON.stringify([{ wm_class: 'firefox', pid: 1717, focus: true, title }]);
    const sessionBus: SessionBus = {
      call: () => Promise.resolve([list]),
      subscribe: () => Promise.reject(new Error('the window collector does not subscribe')),
      close: (): void => undefined,
    };
    const collector = createWindowCollector();
    if (collector.collect === undefined) {
      throw new Error('the window collector polls');
    }

    // Act
    const samples = await collector.collect({ ...context(), sessionBus });

    // Assert: the app is there, the title is not.
    const payload = JSON.stringify(samples);
    expect(payload).toContain('"wmClass":"firefox"');
    expect(payload).not.toContain(title);
    expect(payload).not.toMatch(/title/i);
  });

  it('[T62] the ingest contract rejects a window sample that carries a title', () => {
    // Arrange
    const sample = {
      kind: 'window',
      ts: '2026-11-09T08:00:00.000Z',
      wmClass: 'firefox',
      title: 'Inbox',
      pid: 1717,
      locked: false,
    };

    // Act / Assert
    expect(WindowSample.safeParse(sample).success).toBe(false);
  });
});

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
describe.skipIf(!available)('ST17 stored title setting is removed', () => {
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

  it('[T62] reads a settings row in the old shape after migrating, and migrating twice is harmless', async () => {
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
