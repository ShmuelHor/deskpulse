import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ALREADY_MIGRATED_NOTICE,
  COPY_IMAGE,
  type DockerRunner,
  LEGACY_VOLUME,
  migrateVolume,
  NEW_VOLUME,
  VolumeMigrationError,
} from '../lib/volume-migration.js';

interface FakeDocker extends DockerRunner {
  readonly calls: string[][];
}

/** Answers by the first two args; `fail` lists the commands that exit non-zero. */
function fakeDocker(options: {
  readonly volumes: readonly string[];
  readonly usedBy?: string;
  readonly fail?: readonly string[];
}): FakeDocker {
  const calls: string[][] = [];
  return {
    calls,
    run: (args): ReturnType<DockerRunner['run']> => {
      calls.push([...args]);
      const key = args.slice(0, 2).join(' ');
      if (key === 'volume inspect') {
        return Promise.resolve({
          code: options.volumes.includes(args[2] ?? '') ? 0 : 1,
          stdout: '',
        });
      }
      if (key === 'ps --quiet') {
        return Promise.resolve({
          code: options.fail?.includes(key) ? 1 : 0,
          stdout: options.usedBy ?? '',
        });
      }
      const entrypoint = args[args.indexOf('--entrypoint') + 1] ?? key;
      return Promise.resolve({ code: options.fail?.includes(entrypoint) ? 1 : 0, stdout: '' });
    },
  };
}

const mutating = (docker: FakeDocker): string[][] =>
  docker.calls.filter((call) => call[0] !== 'volume' || call[1] !== 'inspect');

describe('migrateVolume', () => {
  it('does nothing when there is no old volume', async () => {
    const docker = fakeDocker({ volumes: [] });

    expect(await migrateVolume(docker)).toBe('nothing-to-migrate');
    expect(mutating(docker)).toEqual([]);
  });

  it('does nothing once the new volume exists, so a rerun never overwrites it', async () => {
    const docker = fakeDocker({ volumes: [LEGACY_VOLUME, NEW_VOLUME] });

    expect(await migrateVolume(docker)).toBe('already-migrated');
    expect(mutating(docker)).toEqual([]);
  });

  it('refuses while a container still uses the old volume', async () => {
    const docker = fakeDocker({ volumes: [LEGACY_VOLUME], usedBy: 'abc123' });

    await expect(migrateVolume(docker)).rejects.toMatchObject({ code: 'LEGACY_STACK_RUNNING' });
    expect(docker.calls.some((call) => call[0] === 'run')).toBe(false);
  });

  it('fails closed when docker ps itself fails', async () => {
    const docker = fakeDocker({ volumes: [LEGACY_VOLUME], fail: ['ps --quiet'] });

    await expect(migrateVolume(docker)).rejects.toMatchObject({ code: 'STACK_CHECK_FAILED' });
    expect(docker.calls.some((call) => call[0] === 'run')).toBe(false);
  });

  it('tells the user how to recover when both volumes exist', () => {
    expect(ALREADY_MIGRATED_NOTICE).toContain('docker compose down -v');
    expect(ALREADY_MIGRATED_NOTICE).toContain('npm run migrate:yoman');
  });

  it('copies with the old volume read-only, offline, then verifies the copy', async () => {
    const docker = fakeDocker({ volumes: [LEGACY_VOLUME] });

    expect(await migrateVolume(docker)).toBe('migrated');

    const [copy, verify] = docker.calls.filter((call) => call[0] === 'run');
    expect(copy).toEqual(
      expect.arrayContaining(['--network', 'none', `${LEGACY_VOLUME}:/from:ro`]),
    );
    expect(copy).toContain(`${NEW_VOLUME}:/to`);
    expect(verify).toContain('test');
  });

  it('labels the new volume so Compose adopts it without a warning', async () => {
    const docker = fakeDocker({ volumes: [LEGACY_VOLUME] });

    await migrateVolume(docker);

    const create = docker.calls.find((call) => call[1] === 'create');
    expect(create).toEqual(expect.arrayContaining(['com.docker.compose.project=deskpulse']));
  });

  it('removes the half-written new volume when the copy fails', async () => {
    const docker = fakeDocker({ volumes: [LEGACY_VOLUME], fail: ['cp'] });

    await expect(migrateVolume(docker)).rejects.toBeInstanceOf(VolumeMigrationError);
    expect(docker.calls.at(-1)).toEqual(['volume', 'rm', NEW_VOLUME]);
    expect(docker.calls.some((call) => call.includes(`${LEGACY_VOLUME}`) && call[1] === 'rm')).toBe(
      false,
    );
  });

  it('removes the new volume when it holds no Postgres data', async () => {
    const docker = fakeDocker({ volumes: [LEGACY_VOLUME], fail: ['test'] });

    await expect(migrateVolume(docker)).rejects.toMatchObject({ code: 'VERIFY_FAILED' });
    expect(docker.calls.at(-1)).toEqual(['volume', 'rm', NEW_VOLUME]);
  });

  it('never removes the old volume', async () => {
    const docker = fakeDocker({ volumes: [LEGACY_VOLUME], fail: ['cp'] });

    await migrateVolume(docker).catch(() => undefined);

    expect(
      docker.calls.filter((call) => call[1] === 'rm').every((call) => call[2] === NEW_VOLUME),
    ).toBe(true);
  });
});

describe('the copy image', () => {
  it('is the image docker-compose.yml runs', () => {
    const compose = readFileSync(
      fileURLToPath(new URL('../../docker-compose.yml', import.meta.url)),
      'utf8',
    );

    expect(compose).toContain(`image: ${COPY_IMAGE}`);
  });
});

describe('the compose project', () => {
  it('is pinned to deskpulse so the volume name does not follow the folder', () => {
    const compose = readFileSync(
      fileURLToPath(new URL('../../docker-compose.yml', import.meta.url)),
      'utf8',
    );

    expect(compose).toMatch(/^name: deskpulse$/m);
  });
});
