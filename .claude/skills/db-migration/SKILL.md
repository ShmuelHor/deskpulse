---

name: db-migration
description: Add a PostgreSQL migration to a DeskPulse service or the gateway, with Kysely types and a backward-compat test. Use for any schema/table/column change.
---

# DB migration

Each service owns one schema and one role. The gateway owns only `gateway.settings`.
Never touch another service's schema.

## Steps

1. List `services/<svc>/migrations/` (or `apps/gateway/migrations/`). Files are
   `<timestamp>_<kebab>.sql`, and each service counts up from its own base: the next file is the
   latest number + 1 (`1762588800004_drop-window-titles.sql` → `1762588800005_…`).
2. Plain SQL in node-pg-migrate's format: a `-- Up Migration` section and a `-- Down Migration`
   section (see `apps/gateway/migrations/1762588800002_add-palette-setting.sql`). Prefer additive
   changes (nullable column or default) over rename/drop, keep it safe to repeat, and never edit a
   merged migration.
3. Update the Kysely types: `src/adapters/*-table.ts` in a service, the `GatewayDatabase` interface in
   `apps/gateway/src/core/database.ts` for the gateway.
4. **Required test**: a row written in the old shape is still readable after the migration
   (a lesson from wave 4A).
5. Migrations run at start through `runMigrations` in `packages/service-kit/src/migrations.ts`, under
   a per-schema advisory lock. Don't add a separate runner.

## Verify

```
npm run check
npx vitest run services/<svc>/test
npm run start && npm run logs   # the migration applies cleanly
```
