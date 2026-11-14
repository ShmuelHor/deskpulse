import type { Alert, AlertParams, AlertType } from '@deskpulse/shared/alerts';
import type { IncidentType } from '@deskpulse/shared/system';

import type { IncidentState } from './incident.js';

const ALERT_TYPES: Readonly<Record<IncidentType, AlertType>> = {
  cpu: 'pressure-incident',
  memory: 'pressure-incident',
  io: 'pressure-incident',
  'memory-critical': 'memory-critical',
  thermal: 'thermal',
  'memory-leak': 'memory-leak',
};

/**
 * One key per condition, not per incident, so focus's rate limit (one alert
 * per key per 10 min) also holds back an incident that keeps reopening. A
 * leak is keyed by its process.
 */
function alertKey(incident: IncidentState): string {
  return incident.pid === null
    ? `system:${incident.type}`
    : `system:${incident.type}:${incident.pid}`;
}

function alertParams(incident: IncidentState): AlertParams {
  const [culprit] = incident.culprits;
  const top = culprit === undefined ? {} : { comm: culprit.comm, pid: culprit.pid };
  if (incident.type === 'memory-leak') {
    return { ...top, bytesPerHour: incident.peak };
  }
  if (incident.type === 'thermal') {
    return { celsius: incident.peak };
  }
  return { resource: incident.type, peak: incident.peak, ...top };
}

/** The alert for an incident that just opened, at the moment it opened. */
export function incidentAlert(incident: IncidentState, openedAtMs: number): Alert {
  return {
    alertKey: alertKey(incident),
    type: ALERT_TYPES[incident.type],
    ts: new Date(openedAtMs).toISOString(),
    params: alertParams(incident),
  };
}

/** One alert per key: the first. Focus would drop the rest within 10 min anyway. */
export function uniqueAlerts(alerts: readonly Alert[]): Alert[] {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    if (seen.has(alert.alertKey)) {
      return false;
    }
    seen.add(alert.alertKey);
    return true;
  });
}
