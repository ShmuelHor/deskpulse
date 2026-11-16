# DeskPulse

Local-only desktop control center for Linux (GNOME Wayland). Microservices in Docker behind one
gateway, a host agent, and a React widget-grid UI. Nothing leaves the machine.
Called Yoman until wave 4: leftovers exist (`migrate:yoman`, old migrations), don't build on them.

## Read on demand, not up front
- `docs/TASKS.md`: your task, its "Owns" paths and "Done when" list
- `docs/SPEC.md`: product behavior · `docs/DESIGN.md`: UI · `docs/SECURITY.md`: threats, ST tests, PR checklist (§6)
- Roles: `.claude/agents/{task-worker,code-reviewer,security-reviewer}.md`; the main session coordinates (skill `coordinate-wave`)
- Recurring work has skills in `.claude/skills/`: new-endpoint · db-migration · web-page · security-test · settings-change · coordinate-wave

## Commands
- Setup: `npm ci && npm run setup` (creates `.env` at 0600). Stack: `docker compose up -d` or `npm run start` / `stop` / `logs`
- Agent: `npm run agent:dev` · Web: `npm run dev -w @deskpulse/web` · Gateway: `npm run dev -w @deskpulse/gateway`
- Build: `npm run build:packages` (shared + service-kit); no root build script
- Before a PR: `npm run check && npm test && npm run test:security`; `npm run format` applies Biome fixes
- Single test: `npm run build:packages && npx vitest run <path>` (or `-t "name"`). Tests run only through the
  root vitest: `npm test -w <pkg>` finds nothing in web or service-kit. No e2e or Playwright yet.
- `npm run security:todo` lists ST tests still `it.todo` (`-- --strict` fails on any)

## Layout
- `apps/agent`: host agent (collectors/, actuators/, core/, sender/), not in Docker
- `apps/gateway`: the only entry point. core/ + routes/<domain>/index.ts + migrations/ (`gateway.settings` only)
- `apps/web`: React 19 + MUI 7. pages/<page>/ (found by glob), components/, theme/, api/, i18n/{he,en}/
- `services/<svc>/src/`: routes/, use-cases/, domain/, adapters/, jobs/ + config.ts (not in sessions),
  contracts.ts, service.ts, main.ts; SQL in `services/<svc>/migrations/`
- `packages/shared`: Zod contracts and the route map · `packages/service-kit`: service infrastructure
- Layering: route → use-case → domain (pure, no IO) + adapters (DB, HTTP, D-Bus, fs). Dependencies are
  passed in, never imported as singletons

## Code rules
- kebab-case files, one concept per file, named exports only, no barrels. Relative imports end in `.js`
- TS strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. No `any`, no `!`,
  no `as` except at a validated boundary. Explicit return types and TSDoc on exports. No magic numbers
- Small single-purpose functions, early returns. Comments say why. No commented-out code; `TODO(T45): …` only
- Errors: typed `AppError` subclasses with stable codes; never swallow; only routes map them to HTTP, no internals
- Logs: pino only, no `console.*`, structured fields. Never log titles, cmdlines, tokens, cookies, cleanup paths
- Tests: `<pkg>/test/` mirrors `src/` (never next to code; `scripts/lib` → `scripts/test`), AAA, descriptive
  names, fake timers, no sleeps, no network, behavior not implementation. Coverage 60%; 80% for
  `services/*/src/domain`, `apps/agent/src/core`, `scripts/lib`
- Prefer a popular maintained library over hand-written infrastructure; latest stable, pinned exactly,
  justified in the PR. Consistency beats cleverness: follow existing patterns, fix a wrong one everywhere in its own PR

## Zod (the only validation library)
- Parse at every boundary: env, HTTP in and out, service replies, D-Bus, `/proc` and `/sys`, `JSON.parse`,
  child output, caught `unknown`. Never `as` on untrusted data
- Shared contracts in `packages/shared`, named like the type, `type X = z.infer<typeof X>`; never hand-write a duplicate type
- `.parse` where invalid data is a bug, `.safeParse` for user input → 400 with field paths. `.strict()` objects and
  bounded strings, numbers and arrays at the public API

## Security (blocking)
- Never commit `.env`, tokens or real data; placeholders only in `.env.example`. Never weaken gitleaks, CI
  security jobs, hooks or branch protection; no `continue-on-error`
- Only `127.0.0.1:4710` (web) and `127.0.0.1:4711` (gateway) are published. Host, Origin, CORS, CSP change only with SECURITY.md
- `execFile` with an args array, never `shell: true`. Parameterized SQL; each service has its own role and schema
- App, process and container names are untrusted. Window titles are never collected; the agent sends `comm`, never `cmdline`
- Agent: never root, never requires or grants the docker group (Docker features only with existing access; DeskPulse's
  own containers are protected). Acts on the host only via a confirmed command it re-validates (SPEC §4.3) inside
  allowlists. Saves GNOME settings before changing them, restorable after a crash. Never touches system apps
- `.env` and state files 0600, their directories 0700. Containers non-root, read-only rootfs, `cap_drop: [ALL]`,
  `no-new-privileges`, memory limits, no docker.sock. Actions pinned to a SHA, images to a digest

## Product rules
- Web and agent talk only to the gateway. Services never call each other or read another schema
- Agent ≤ 0.5% CPU and ≤ 60 MB RSS with the window closed; live 2 s sampling only while the window is visible;
  everything pauses on screen lock. No new polling without updating SPEC §4.1
- UI is MUI. Colors only from `apps/web/src/theme/color-tokens.ts` (not the deprecated aliases), other tokens from
  `mui-theme.ts`. No CSS files, no hex elsewhere, no orange or green. Shadows from elevation tokens; the only
  gradient is the skeleton shimmer; live blur only on the sidebar and dialogs (DESIGN §4)
- Every string in `he` and `en` (Hebrew default). Logical CSS properties only. Dates and numbers through `Intl`

## Language
- Everything in the repo is English: code, comments, logs, commits, PRs, docs. Hebrew only in `**/i18n/he/**`
  (`npm run check` fails otherwise). Agents talk to the user in Hebrew

## Git
- Never commit to `main`; every change goes branch → PR → review → merge. Branches `t<id>-<kebab>`, `fix/…`, `chore/…`
- Conventional Commits in English, header ≤ 72, subject not capitalized, `!` for breaking. Types: feat fix test
  refactor perf docs chore ci build security revert. Small commits that each build and pass tests
- Never force push, never `--no-verify`, never rewrite pushed history. Never commit generated output or data

## Do not touch without explicit instruction
- Generated: dist/, coverage/, *.tsbuildinfo, node_modules/. Secrets: .env, *.pem, *.key (env names: read config.ts)
- CI security jobs, `scripts/pre-commit.ts`, `.gitleaks.toml`, `apps/gateway/src/core/{origins,security-headers}.ts`
- `apps/agent/src/actuators/` (muter). `packages/shared`: a contract change ships as its own PR first
- Old pages `apps/web/src/pages/{apps,battery,system,today,dev-components}`: deleted in T57, don't extend
