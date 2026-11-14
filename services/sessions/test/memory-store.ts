import { randomUUID } from 'node:crypto';
import type { App, Session } from '@deskpulse/shared/sessions';

import type { Span } from '../src/domain/merge-samples.js';
import type { SessionsStore, SessionsTransaction, StoredSpan } from '../src/use-cases/store.js';

interface State {
  apps: App[];
  sessions: StoredSpan[];
  recordedUntil: number | null;
}

export interface MemoryStore extends SessionsStore {
  /** The committed state, for assertions. */
  readonly state: () => State;
}

function toSession(span: StoredSpan): Session {
  return {
    id: span.id,
    appId: span.appId,
    start: new Date(span.startMs).toISOString(),
    end: new Date(span.endMs).toISOString(),
  };
}

function bind(state: State): SessionsTransaction {
  const save = (span: Span): StoredSpan => {
    const stored = { ...span, id: span.id ?? randomUUID() };
    state.sessions = [...state.sessions.filter((s) => s.id !== stored.id), stored];
    return stored;
  };
  return {
    lockOpenSession: async (): Promise<Span | null> => {
      const open = state.sessions.find((s) => !s.closed);
      return open === undefined ? null : { ...open };
    },
    recordedUntil: async () => state.recordedUntil,
    setRecordedUntil: async (tsMs): Promise<void> => {
      state.recordedUntil = tsMs;
    },
    saveSpans: async (spans) => spans.map(save),
    closedSpansOverlapping: async (fromMs, toMs, limit) =>
      state.sessions
        .filter((s) => s.closed && s.startMs <= toMs && s.endMs >= fromMs)
        .sort((a, b) => a.startMs - b.startMs)
        .slice(0, limit),
    listSessions: async (range, limit) =>
      state.sessions
        .filter((s) => s.startMs < Date.parse(range.to) && s.endMs >= Date.parse(range.from))
        .sort((a, b) => a.startMs - b.startMs)
        .slice(0, limit)
        .map(toSession),
    ensureApps: async (ids): Promise<void> => {
      for (const id of ids) {
        if (!state.apps.some((app) => app.id === id)) {
          state.apps.push({ id, name: id, icon: null });
        }
      }
    },
    listApps: async (limit) => state.apps.slice(0, limit),
    updateApp: async (id, update): Promise<App | null> => {
      const app = state.apps.find((a) => a.id === id);
      if (app === undefined) {
        return null;
      }
      const updated = { ...app, ...update };
      state.apps = state.apps.map((a) => (a.id === id ? updated : a));
      return updated;
    },
  };
}

/** An in-memory store with the Postgres store's semantics, rolling back when `work` throws. */
export function createMemoryStore(initial: Partial<State> = {}): MemoryStore {
  let committed: State = { apps: [], sessions: [], recordedUntil: null, ...initial };
  return {
    state: () => committed,
    transaction: async <T>(work: (tx: SessionsTransaction) => Promise<T>): Promise<T> => {
      const draft = structuredClone(committed);
      const result = await work(bind(draft));
      committed = draft;
      return result;
    },
  };
}
