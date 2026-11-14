import type { Scheduler } from './scheduler.js';

/** Whether the screen is locked. Read by collectors, such as window for its samples. */
export interface Presence {
  readonly locked: boolean;
}

/** Reported by the lock collector only. */
export type PresenceUpdate = Partial<Presence>;

export interface PresenceTracker {
  /** A live view: it always reads the latest reported values. */
  readonly presence: Presence;
  report(update: PresenceUpdate): void;
}

/**
 * Tracks the screen lock, and pauses every polling collector
 * while the screen is locked (SPEC §4.1, §4.4). Unlocking resumes them, which
 * runs each one at once.
 */
export function createPresenceTracker(
  scheduler: Pick<Scheduler, 'pause' | 'resume'>,
): PresenceTracker {
  let locked = false;

  return {
    presence: {
      get locked(): boolean {
        return locked;
      },
    },
    report(update): void {
      const wasLocked = locked;
      locked = update.locked ?? locked;
      if (locked === wasLocked) {
        return;
      }
      if (locked) {
        scheduler.pause();
      } else {
        scheduler.resume();
      }
    },
  };
}
