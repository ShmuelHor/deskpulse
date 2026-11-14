/**
 * Moves the data of a pre-DeskPulse install into the DeskPulse volume, once.
 * The old volume is kept; remove it yourself once you are happy:
 * `docker volume rm yoman_pgdata`.
 *
 * Usage: npm run migrate:yoman   (stop the old stack first: docker compose -p yoman down)
 */
import { execFile } from 'node:child_process';

import {
  ALREADY_MIGRATED_NOTICE,
  type DockerRunner,
  migrateVolume,
  VolumeMigrationError,
} from './lib/volume-migration.js';

const EXIT_FAILURE = 1;
const MAX_OUTPUT_BYTES = 1_048_576;
const MESSAGES = {
  'nothing-to-migrate': 'No pre-DeskPulse data volume found. Nothing to migrate.',
  'already-migrated': ALREADY_MIGRATED_NOTICE,
  migrated:
    'Data copied to the DeskPulse volume. The old volume is untouched; remove it with `docker volume rm yoman_pgdata` once you are sure.',
} as const;

const docker: DockerRunner = {
  run: (args) =>
    new Promise((resolve) => {
      execFile('docker', [...args], { maxBuffer: MAX_OUTPUT_BYTES }, (error, stdout) => {
        const code =
          error === null ? 0 : typeof error.code === 'number' ? error.code : EXIT_FAILURE;
        resolve({ code, stdout: stdout.trim() });
      });
    }),
};

try {
  process.stdout.write(`${MESSAGES[await migrateVolume(docker)]}\n`);
} catch (error: unknown) {
  const message =
    error instanceof VolumeMigrationError ? error.message : 'Migration failed unexpectedly';
  process.stderr.write(`${message}\n`);
  process.exitCode = EXIT_FAILURE;
}
