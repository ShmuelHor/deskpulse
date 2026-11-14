import { defineRoute, type Route } from '@deskpulse/service-kit/route';
import { TimeRangeQuery } from '@deskpulse/shared/common';
import { IncidentList } from '@deskpulse/shared/system';

import { listIncidents } from '../use-cases/list-incidents.js';
import type { RouteDeps } from './route-deps.js';

export function incidentRoutes({ store }: RouteDeps): Route[] {
  return [
    defineRoute({
      method: 'GET',
      url: '/incidents',
      schema: { query: TimeRangeQuery, response: IncidentList },
      handler: async ({ query }) => ({ items: await listIncidents(store, query) }),
    }),
  ];
}
