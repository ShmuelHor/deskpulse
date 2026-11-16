---

name: settings-change
description: Add or change a user setting in DeskPulse (shared schema, gateway settings row and migration, settings page). Use for anything under Settings.
---

# Settings change

Settings live only in the gateway: one JSONB row in `gateway.settings`. Services don't store them.
Page layouts sit in the same row under `layouts`, outside the public `Settings` body.

## Steps

1. **Schema**: `packages/shared/src/settings.ts`, bounded and strict. ⚠ The shared change goes in
   its own PR first.
2. `npm run build:packages`
3. **Migration**: `Settings` is strict and a new key is required, so a row saved before the change
   would fail every read. Add a SQL migration in `apps/gateway/migrations/` that fills the key in old
   rows, as `1762588800002_add-palette-setting.sql` does. Follow the db-migration skill, including the
   old-row-still-readable test.
4. **Store**: `apps/gateway/src/core/settings-store.ts`. Add the new value's default to
   `DEFAULT_SETTINGS` (used when no row was saved yet). The row is parsed with `StoredSettings`;
   change that only if the storage shape changes.
5. **UI**: `apps/web/src/pages/settings/`. The form schema is `SettingsForm` in `settings-form.ts`
   (built from the shared schema), rendered with react-hook-form in `settings-form-view.tsx`. Text
   in i18n he + en. Follow the web-page skill.
6. **Tests**: schema default and validation (`packages/shared/test/settings.test.ts`), the migration
   and store (`apps/gateway/test/`), and the form (`apps/web/test/pages/settings/`).

## Verify

```
npm run check
npx vitest run packages/shared/test apps/gateway/test apps/web/test/pages/settings
```
