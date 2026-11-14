/**
 * One-time move of the Postgres data volume from the pre-DeskPulse Compose project
 * (`yoman`, named after the checkout folder) to the pinned `deskpulse` project.
 *
 * Only the volume name changes. Database, schema and role names never carried the
 * old name and the password hashes live inside the data directory, so copying the
 * directory keeps every role and password valid with the same `.env`.
 */

export const LEGACY_VOLUME = 'yoman_pgdata';
export const NEW_VOLUME = 'deskpulse_pgdata';
/** The labels Compose sets, so it adopts the volume instead of warning about it. */
export const NEW_VOLUME_LABELS: readonly string[] = [
  'com.docker.compose.project=deskpulse',
  'com.docker.compose.volume=pgdata',
];
/** The pinned image `docker-compose.yml` runs; a test keeps the two in step. */
export const COPY_IMAGE =
  'postgres:16-alpine@sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139';
/** Present in every initialized Postgres data directory. */
export const DATA_MARKER = 'PG_VERSION';

/** Shown when both volumes exist: the new one may be empty from an early `compose up`. */
export const ALREADY_MIGRATED_NOTICE = [
  'The DeskPulse data volume already exists, so nothing was copied.',
  'If the app looks empty, the new volume was probably created by an early `docker compose up`.',
  'To recover: `docker compose down -v`, then `npm run migrate:yoman`.',
].join('\n');

export type MigrationOutcome = 'nothing-to-migrate' | 'already-migrated' | 'migrated';

/** What `docker` answered, reduced to what the plan needs. */
export interface DockerRunner {
  /** Runs `docker <args>`; resolves with the exit code and trimmed stdout. */
  readonly run: (
    args: readonly string[],
  ) => Promise<{ readonly code: number; readonly stdout: string }>;
}

export class VolumeMigrationError extends Error {
  public readonly code:
    | 'LEGACY_STACK_RUNNING'
    | 'STACK_CHECK_FAILED'
    | 'COPY_FAILED'
    | 'VERIFY_FAILED';

  public constructor(code: VolumeMigrationError['code'], message: string) {
    super(message);
    this.name = 'VolumeMigrationError';
    this.code = code;
  }
}

async function volumeExists(docker: DockerRunner, name: string): Promise<boolean> {
  return (await docker.run(['volume', 'inspect', name])).code === 0;
}

function copyArgs(): readonly string[] {
  return [
    'run',
    '--rm',
    '--network',
    'none',
    '--user',
    '0:0',
    '--entrypoint',
    'cp',
    '-v',
    `${LEGACY_VOLUME}:/from:ro`,
    '-v',
    `${NEW_VOLUME}:/to`,
    COPY_IMAGE,
    '-a',
    '/from/.',
    '/to/',
  ];
}

function verifyArgs(): readonly string[] {
  return [
    'run',
    '--rm',
    '--network',
    'none',
    '--entrypoint',
    'test',
    '-v',
    `${NEW_VOLUME}:/to:ro`,
    COPY_IMAGE,
    '-f',
    `/to/${DATA_MARKER}`,
  ];
}

async function discardPartialCopy(docker: DockerRunner): Promise<void> {
  // Without this a rerun would see the half-filled volume and call it migrated.
  await docker.run(['volume', 'rm', NEW_VOLUME]);
}

/**
 * Copies `yoman_pgdata` into `deskpulse_pgdata` and leaves the old volume untouched.
 * Safe to rerun: it does nothing once the new volume exists, and a failed copy
 * removes the half-written new volume.
 */
export async function migrateVolume(docker: DockerRunner): Promise<MigrationOutcome> {
  if (!(await volumeExists(docker, LEGACY_VOLUME))) {
    return 'nothing-to-migrate';
  }
  if (await volumeExists(docker, NEW_VOLUME)) {
    return 'already-migrated';
  }
  const users = await docker.run(['ps', '--quiet', '--filter', `volume=${LEGACY_VOLUME}`]);
  if (users.code !== 0) {
    // Fail closed: an unanswered question is not an answer of "nobody uses it".
    throw new VolumeMigrationError(
      'STACK_CHECK_FAILED',
      'Could not tell whether the old stack is running (docker ps failed)',
    );
  }
  if (users.stdout !== '') {
    throw new VolumeMigrationError(
      'LEGACY_STACK_RUNNING',
      'The old stack still uses the data volume. Stop it first: docker compose -p yoman down',
    );
  }
  const created = await docker.run([
    'volume',
    'create',
    ...NEW_VOLUME_LABELS.flatMap((label) => ['--label', label]),
    NEW_VOLUME,
  ]);
  if (created.code !== 0) {
    throw new VolumeMigrationError('COPY_FAILED', 'Could not create the new data volume');
  }
  if ((await docker.run(copyArgs())).code !== 0) {
    await discardPartialCopy(docker);
    throw new VolumeMigrationError('COPY_FAILED', 'Copying the data volume failed');
  }
  if ((await docker.run(verifyArgs())).code !== 0) {
    await discardPartialCopy(docker);
    throw new VolumeMigrationError('VERIFY_FAILED', 'The copied volume holds no Postgres data');
  }
  return 'migrated';
}
