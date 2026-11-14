import { queryOptions, type UseQueryOptions } from '@tanstack/react-query';

import type { RouteOutput } from '../../api/client.js';
import type { GatewayClient, GatewayRoutes } from '../../api/gateway.js';

type Output<N extends keyof GatewayRoutes> = RouteOutput<GatewayRoutes[N]>;

/** The user's apps. Names are untrusted: render them as text only. */
export function appsQuery(
  client: GatewayClient,
): UseQueryOptions<Output<'listApps'>, Error, Output<'listApps'>, string[]> {
  return queryOptions({
    queryKey: ['listApps'],
    queryFn: ({ signal }) => client.request('listApps', undefined, signal),
  });
}
