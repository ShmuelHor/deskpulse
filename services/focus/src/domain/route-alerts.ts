import type { Alert, AlertType } from '@deskpulse/shared/alerts';

const MS_PER_MINUTE = 60_000;
const DEDUPE_MINUTES = 10;

/** The same `alertKey` is let through at most once in this window (SPEC §5 focus). */
export const RATE_LIMIT_MS = DEDUPE_MINUTES * MS_PER_MINUTE;

/** The only alert that gets through during focus: the battery is almost empty (SPEC §5 focus). */
export const ALWAYS_DELIVERED: AlertType = 'battery-critical';

export type Decision = 'deliver' | 'queue';

/**
 * The fixed rule of SPEC §5 focus, with no settings: outside focus everything
 * is delivered; during focus only {@link ALWAYS_DELIVERED} is, and the rest is
 * held for the focus-end summary.
 */
export function decide(type: AlertType, inFocus: boolean): Decision {
  return !inFocus || type === ALWAYS_DELIVERED ? 'deliver' : 'queue';
}

/** True when an alert with this key was let through (delivered or queued) less than 10 min ago. */
export function isRateLimited(lastAcceptedMs: number | undefined, nowMs: number): boolean {
  return lastAcceptedMs !== undefined && nowMs - lastAcceptedMs < RATE_LIMIT_MS;
}

export interface RoutingInput {
  readonly alerts: readonly Alert[];
  readonly inFocus: boolean;
  /** When each key was last let through, for the keys in `alerts`. */
  readonly lastAccepted: ReadonlyMap<string, number>;
  readonly nowMs: number;
}

export interface RoutingOutcome {
  readonly deliver: Alert[];
  readonly queue: Alert[];
  /** Alerts dropped as duplicates inside the 10 min window. */
  readonly limited: number;
  /** The keys let through now, which restart their window. */
  readonly acceptedKeys: string[];
}

/**
 * Decides every alert of a batch, in order. A second alert with the same key
 * in one batch falls inside the first one's window.
 */
export function routeAlerts(input: RoutingInput): RoutingOutcome {
  const lastAccepted = new Map(input.lastAccepted);
  const decided: Record<Decision, Alert[]> = { deliver: [], queue: [] };
  const acceptedKeys: string[] = [];
  let limited = 0;
  for (const alert of input.alerts) {
    if (isRateLimited(lastAccepted.get(alert.alertKey), input.nowMs)) {
      limited += 1;
      continue;
    }
    lastAccepted.set(alert.alertKey, input.nowMs);
    acceptedKeys.push(alert.alertKey);
    decided[decide(alert.type, input.inFocus)].push(alert);
  }
  return { deliver: decided.deliver, queue: decided.queue, limited, acceptedKeys };
}
