import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyDir } from '../../src/core/legacy-state.js';
import { modeOf, PRIVATE_DIR_MODE, PRIVATE_FILE_MODE } from '../../src/core/private-fs.js';

const LOOSE_DIR_MODE = 0o755;

describe('migrateLegacyDir', () => {
  let root: string;
  let legacy: string;
  let next: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'deskpulse-legacy-'));
    legacy = join(root, 'yoman');
    next = join(root, 'deskpulse');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function seedLegacy(): Promise<void> {
    await mkdir(join(legacy, 'buffer'), { recursive: true, mode: 0o700 });
    await writeFile(join(legacy, 'muted.json'), '{"old":true}', { mode: 0o600 });
    await writeFile(join(legacy, 'buffer', 'h1.jsonl'), 'line\n', { mode: 0o600 });
  }

  it('does nothing when there is no old directory', async () => {
    expect(await migrateLegacyDir(next)).toBe('none');
    await expect(stat(next)).rejects.toThrow();
  });

  it('moves the old directory with its files and private modes', async () => {
    await seedLegacy();

    expect(await migrateLegacyDir(next)).toBe('moved');

    expect(await readFile(join(next, 'muted.json'), 'utf8')).toBe('{"old":true}');
    expect(await readFile(join(next, 'buffer', 'h1.jsonl'), 'utf8')).toBe('line\n');
    expect(await modeOf(next)).toBe(PRIVATE_DIR_MODE);
    expect(await modeOf(join(next, 'muted.json'))).toBe(PRIVATE_FILE_MODE);
    await expect(stat(legacy)).rejects.toThrow();
  });

  it('forces a loose old directory to 0700', async () => {
    await seedLegacy();
    await chmod(legacy, LOOSE_DIR_MODE);

    await migrateLegacyDir(next);

    expect(await modeOf(next)).toBe(PRIVATE_DIR_MODE);
  });

  it('never overwrites existing new data, adds only what is missing and keeps the old copy', async () => {
    await seedLegacy();
    await mkdir(next, { mode: 0o700 });
    await writeFile(join(next, 'muted.json'), '{"new":true}', { mode: 0o600 });

    expect(await migrateLegacyDir(next)).toBe('merged');

    expect(await readFile(join(next, 'muted.json'), 'utf8')).toBe('{"new":true}');
    expect(await readFile(join(next, 'buffer', 'h1.jsonl'), 'utf8')).toBe('line\n');
    expect(await readFile(join(legacy, 'muted.json'), 'utf8')).toBe('{"old":true}');
  });

  it('is idempotent: a second run after a move finds nothing to do', async () => {
    await seedLegacy();
    await migrateLegacyDir(next);

    expect(await migrateLegacyDir(next)).toBe('none');
    expect(await readFile(join(next, 'muted.json'), 'utf8')).toBe('{"old":true}');
  });
});
