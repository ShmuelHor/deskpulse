import { defineRoute, type Route } from '@deskpulse/service-kit/route';
import { AlertQueue } from '@deskpulse/shared/focus';

import { RouteRequest, RouteResult } from '../contracts.js';
import { listQueue, routeIncoming } from '../use-cases/route-alerts.js';
import type { RouteDeps } from './route-deps.js';

export function alertRoutes({ store, now }: RouteDeps): Route[] {
  return [
    defineRoute({
      method: 'POST',
      url: '/route',
      schema: { body: RouteRequest, response: RouteResult },
      handler: ({ body }) => routeIncoming(store, body, now()),
    }),
    defineRoute({
      method: 'GET',
      url: '/queue',
      schema: { response: AlertQueue },
      handler: async () => ({ items: await listQueue(store) }),
    }),
  ];
}
