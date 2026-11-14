import { defineRoute, type Route } from '@deskpulse/service-kit/route';
import { SystemTimeline } from '@deskpulse/shared/system';

import { TimelineQuery } from '../contracts.js';
import { systemTimeline } from '../use-cases/system-timeline.js';
import type { RouteDeps } from './route-deps.js';

export function timelineRoutes({ store, timeZone }: RouteDeps): Route[] {
  return [
    defineRoute({
      method: 'GET',
      url: '/timeline',
      schema: { query: TimelineQuery, response: SystemTimeline },
      handler: ({ query }) => systemTimeline(store, query.date, timeZone),
    }),
  ];
}
