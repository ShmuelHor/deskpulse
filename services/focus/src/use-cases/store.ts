import type { Alert, QueuedAlert } from '@deskpulse/shared/alerts';
import type { KnownApp, Profile, ProfileInput } from '@deskpulse/shared/focus';

import type { FocusSession } from '../domain/focus-session.js';

/** A session about to be stored. */
export interface NewFocusSession {
  readonly profileId: string;
  readonly startedAtMs: number;
  readonly endsAtMs: number;
  readonly mutedApps: readonly string[];
}

/**
 * Everything the use cases need from storage, inside one transaction. The
 * Postgres adapter implements it; tests use an in-memory one.
 */
export interface FocusTransaction {
  /** Serializes writers until the transaction ends, so state changes never interleave. */
  readonly lock: () => Promise<void>;

  /** The session nothing has closed yet, which may be past its end time. */
  readonly openSession: () => Promise<FocusSession | null>;
  readonly startSession: (session: NewFocusSession) => Promise<FocusSession>;
  readonly endSession: (id: string, endedAtMs: number) => Promise<void>;

  readonly listProfiles: (limit: number) => Promise<Profile[]>;
  readonly countProfiles: () => Promise<number>;
  /** `null` when there is no such profile. */
  readonly getProfile: (id: string) => Promise<Profile | null>;
  /** The oldest profile, used when a focus names none. `null` when there are none. */
  readonly defaultProfile: () => Promise<Profile | null>;
  readonly createProfile: (input: ProfileInput) => Promise<Profile>;
  /** `null` when there is no such profile. */
  readonly updateProfile: (id: string, input: ProfileInput) => Promise<Profile | null>;
  /** `false` when there is no such profile. */
  readonly deleteProfile: (id: string) => Promise<boolean>;

  readonly listKnownApps: (limit: number) => Promise<KnownApp[]>;
  /** Adds new apps and refreshes known ones. Returns how many were new. */
  readonly saveKnownApps: (apps: readonly KnownApp[]) => Promise<number>;

  /** When each of `keys` was last let through, for the keys still inside a window. */
  readonly lastAccepted: (keys: readonly string[]) => Promise<Map<string, number>>;
  readonly recordAccepted: (keys: readonly string[], atMs: number) => Promise<void>;
  /** Forgets keys let through before `beforeMs`; their windows are over. */
  readonly forgetAcceptedBefore: (beforeMs: number) => Promise<void>;

  /** Queues alerts, then drops the oldest beyond `capacity`. */
  readonly enqueue: (alerts: readonly Alert[], atMs: number, capacity: number) => Promise<void>;
  /** The queued alerts, oldest first. */
  readonly listQueue: (limit: number) => Promise<QueuedAlert[]>;
  /** Removes every queued alert and returns them, oldest first. */
  readonly drainQueue: () => Promise<QueuedAlert[]>;
}

export interface FocusStore {
  /** Runs `work` in one transaction: committed when it resolves, rolled back when it throws. */
  readonly transaction: <T>(work: (tx: FocusTransaction) => Promise<T>) => Promise<T>;
}
