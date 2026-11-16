---

name: new-endpoint
description: Add or change an API endpoint in DeskPulse (shared Zod contract → service → gateway → web). Use for any new route or a change to a request/response shape.
---

# New endpoint

Two different patterns. Do not mix them:
- **Service** (`services/<svc>`): `defineRoute` from `@deskpulse/service-kit/route` in `src/routes/`,
  e.g. `services/sessions/src/routes/apps.ts`.
- **Gateway** (`apps/gateway`): `defineHandlers` in `src/routes/<domain>/index.ts`, e.g.
  `apps/gateway/src/routes/layouts/index.ts`. The route itself lives in the `routes` map in
  `packages/shared/src/routes.ts`; `core/contract-routes.ts` registers it and `core/route-loader.ts`
  (`loadRouteHandlers`) picks up the domain's `handlers`.

Read the example file for the layer before writing. Don't scan the whole repo.

## Steps

1. **Contract** in `packages/shared/src/<domain>.ts`: Zod schema named like the type, `.strict()`,
   bounded strings and arrays, `type X = z.infer<typeof X>`. A public gateway route goes in the
   `routes` map in `packages/shared/src/routes.ts`, with a response fixture in
   `packages/shared/src/fixtures/responses.ts` (MSW and the web dev mode serve it).
   A gateway-to-service shape with no public counterpart goes in the service's `src/contracts.ts`.
   ⚠ A shared contract change ships as its own PR first. Stop and say so if this task mixes them.
2. `npm run build:packages`
3. **Service**:
   - `domain/`: pure logic, no IO
   - `use-cases/`: orchestrates domain and storage through the store interface in `use-cases/store.ts`
   - `adapters/`: Postgres via Kysely (`pg-store.ts`, `*-table.ts`)
   - `routes/`: `defineRoute({ method, url, schema: { params, query, body, response }, handler })`;
     the handler only calls the use case. Deps come from `routes/route-deps.ts`
   - Add the route function to `buildRoutes` in `src/service.ts`
   - Throw `AppError` subclasses (`@deskpulse/service-kit/errors`); service-kit maps them to HTTP
4. **Gateway**: a handler in `apps/gateway/src/routes/<domain>/` via `defineHandlers`. The handler
   context gives `params`, `query`, `body`, `principal`, `services` (the `ServiceClient`), `settings`
   and `log`. ST03 (auth) and ST08 (fuzzing) cover every route in the map automatically.
5. **Tests**: mirror `src/` under `test/`. Use cases run against `test/memory-store.ts`; routes through
   `test/test-service.ts` (gateway: `test/harness.ts`). Domain needs 80% coverage; use fast-check for
   pure logic where it fits.
6. **Web** (if used): the client in `apps/web/src/api/gateway.ts` is typed from the route map, so only
   `pages/<p>/queries.ts` or `mutations.ts` (TanStack Query) change.

## Verify

```
npm run check
npx vitest run services/<svc>/test apps/gateway/test packages/shared/test
npm run test:security
```
Logs: pino, no sensitive fields.
