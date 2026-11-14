import { cp, lstat, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { ensurePrivateDir } from './private-fs.js';

/** The directory name used before the rename to DeskPulse (T60). Only this file may name it. */
const LEGACY_APP_DIR = 'yoman';

const SystemError = z.object({ code: z.string() });

export type LegacyMigrationOutcome = 'none' | 'moved' | 'merged';

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (SystemError.safeParse(error).data?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Brings the pre-rename directory next to `newDir` (`~/.config/yoman`,
 * `~/.local/state/yoman`) over to its DeskPulse name, once.
 *
 * - No old directory: nothing to do.
 * - No new directory: the old one is renamed, which is atomic and keeps its modes.
 * - A new directory already exists: only entries missing from it are copied, never
 *   overwriting anything, and the old directory stays where it is.
 *
 * The old data is never deleted, so a failure at any point loses nothing.
 */
export async function migrateLegacyDir(newDir: string): Promise<LegacyMigrationOutcome> {
  const legacyDir = join(dirname(newDir), LEGACY_APP_DIR);
  if (!(await exists(legacyDir))) {
    return 'none';
  }
  if (!(await exists(newDir))) {
    await rename(legacyDir, newDir);
    await ensurePrivateDir(newDir);
    return 'moved';
  }
  await cp(legacyDir, newDir, { recursive: true, force: false, errorOnExist: false });
  await ensurePrivateDir(newDir);
  return 'merged';
}
