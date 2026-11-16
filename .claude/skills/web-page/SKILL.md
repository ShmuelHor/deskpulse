---

name: web-page
description: Create or change a page or widget in the DeskPulse React app (apps/web), including routing, data hooks, i18n and theming. Use for any UI work.
---

# Web page / widget

Do not copy from or extend the old pages (apps, battery, system, today, dev-components).
T57 deletes them. `focus` and `settings` are current examples.

## Files for page `<p>`

```
apps/web/src/pages/<p>/
  route.tsx         # found by the glob in router/pages.ts; no registration needed
  <p>-page.tsx
  queries.ts        # TanStack Query reads through the typed GatewayClient (api/gateway.ts)
  mutations.ts      # writes, if any
  *-dialog.tsx, *-form.ts   # react-hook-form + a Zod schema built from packages/shared
apps/web/src/i18n/he/<p>.json   # one namespace per page, loaded by glob; both languages required
apps/web/src/i18n/en/<p>.json
apps/web/test/pages/<p>/
```
A `pages/dev-*` folder is a dev-only tool and is never shipped.

## Rules

- Colors only from `theme/color-tokens.ts`; never the deprecated aliases (surface, accentBg, ok, cat*).
  Other tokens from `theme/mui-theme.ts`. No CSS files, no hex values.
- Logical CSS only (`marginInlineStart`, not `marginLeft`): the app is RTL Hebrew + English.
  `apps/web/biome-plugins/no-physical-style-props.grit` and `test/logical-styles.test.ts` enforce it.
- No hard-coded strings. Every text needs a key in both he and en. Dates and numbers through `Intl`.
- Reusable pieces go in `components/`. MUI components first.
- MSW serves every gateway route from `packages/shared/src/fixtures/responses.ts`; a new route needs a
  fixture there, not a hand-written handler in `mocks/`.
- Widgets: the engine and registry will live in `apps/web/src/widgets/` (T67). Until it merges, check
  docs/TASKS.md.
- For visual decisions, read only the relevant section of docs/DESIGN.md.

## Verify

```
npm run check            # includes the language check
npx vitest run apps/web/test/pages/<p>
```
