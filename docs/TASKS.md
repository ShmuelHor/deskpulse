# DeskPulse: tasks for parallel work

This file is the agents' work queue. Before any task, read: [CLAUDE.md](../CLAUDE.md), [SPEC.md](SPEC.md), [SECURITY.md](SECURITY.md), [DESIGN.md](DESIGN.md).

## How parallel work runs

### Roles
| Role | Who | Responsibility |
|---|---|---|
| **Coordinator** | The main session | Assigns tasks, merges PRs, runs the wave gate and updates the status table. **Only the coordinator edits this file** |
| **Worker** | One agent per task | Works in its own worktree and branch, touches **only** the files the task owns, and opens a PR |
| **Reviewer** | A separate agent | Reviews every PR before merge: correctness, the SECURITY.md §6 checklist, and a check that every "Done when" item is actually met |

### Waves
- Tasks in the same wave **do not depend on each other** and can run in parallel. At most 3 agents run at a time.
- A new wave starts only after the previous **wave gate**: everything is merged to `main`, CI is green, and the gate's checks pass.
- Wave 0 is **CI/CD and security tests**, and it comes before any feature code.

### File ownership (to avoid conflicts)
- Every task has an **Owns** list. A worker does not touch files outside it. If it has to, it stops and reports to the coordinator.
- The layout is designed so that each task adds its own files rather than editing a shared one:
  | Shared resource | How conflicts are avoided |
  |---|---|
  | `docker-compose.yml` | Uses `include:` for `services/<x>/compose.yml` files. T10 creates all the stubs up front |
  | Gateway routes | `@fastify/autoload` from `apps/gateway/src/routes/<domain>/` |
  | Web pages | `import.meta.glob('./pages/*/route.tsx')` |
  | Translations | A namespace per page: `apps/web/src/i18n/{he,en}/<page>.json` |
  | Security tests | A file per ST: `tests/security/stNN-*.test.ts` |
  | Contracts (`packages/shared`) | A file per domain. A contract change = a small separate PR that is merged first |

### Commits like a real developer's
- **A branch per task:** `t13-sessions-service`, created from an up-to-date `main`
- **Small, logical commits**, usually 3–8 per task. Each commit does one thing, builds, and passes tests. For example:
  ```
  feat(sessions): add apps and sessions tables
  feat(sessions): merge consecutive samples into sessions
  test(sessions): cover gaps, idle and out-of-order samples
  feat(sessions): expose GET /sessions
  docs(sessions): document merge rules
  ```
- **Conventional Commits** in English: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`, `build`, `security`. scope = the package name. commitlint enforces this
- The message body explains **why** when it isn't obvious
- No `WIP`, and no chains of "fix typo": fix with an amend before the first push

### Branch → PR → Code Review → Merge
**Nobody commits directly to `main`.** Every change, including docs and CI, goes through a branch and a PR on GitHub. Full details in [CLAUDE.md](../CLAUDE.md#git-flow-branch--pr--code-review--merge).

```
branch t13-…  →  commits  →  push  →  PR (draft)  →  CI green  →  Ready for review
      →  CR: inline comments (blocking / suggestion / question)  →  fix commits  →  re-review
      →  "Verdict: approved"  →  rebase merge  →  delete the branch
```

- **A PR per task**, with a title in the `T13: sessions service` style and a body that follows the full template: what and why, how it was tested, security checklist, enabled ST tests and new dependencies
- **Code review on every PR** by a reviewer agent that did not write the code. It runs the branch itself, leaves inline comments on specific lines and finishes with `Verdict:`
- **After the first push, history is never rewritten** (no amend and no force push), so the reviewer can see what changed. Every comment gets either a fix in a new commit or a reasoned reply
- **Merge** with rebase (which keeps the commits) and delete the branch, only when CI is green, the latest approval is `Verdict: approved` and every thread is resolved
- GitHub does not let an account approve its own PR, so the `Verdict` line is the approval record

---

## Status

| Wave | Tasks | Gate |
|---|---|---|
| 0 · CI/CD and security | [x] T01 [x] T02 [x] T03 [x] T04 [x] T05 [x] T06 [x] T07 | G0 |
| 1 · Contracts and infrastructure | [x] T08 [x] T09 [x] T10 [x] T11 [x] T12 | G1 |
| 2 · Independent units | [x] T13 [x] T14 [x] T15 [x] T16 [x] T17 [x] T18 [x] T19 [x] T20 [x] T21 [x] T22 [x] T23 [x] T24 [x] T25 [x] T26 | G2 |
| 3 · Integration | [x] T27 [x] T28 [x] T29 [x] T30 [x] T31 [x] T32 [x] T33 [x] T34 [x] T35 [x] T36 [x] T37 [x] T38 [x] T39 [x] T40 [x] T41 | G3 |
| 4A · Fix and trim | [ ] #202 [ ] #200 [ ] T60 [ ] T61 [ ] T62 [ ] T63 [ ] T64 [ ] T65 | G4A |
| 4B · Design system, shell, pages | [ ] T66 [ ] T68 [ ] T67 [ ] T57 [ ] T43 [ ] T58 [ ] T69 [ ] T47 | G4B |
| 4C · Control center | [ ] T72 [ ] T73 [ ] T74 [ ] T75 [ ] T76 [ ] T77 [ ] T78 [ ] T79 [ ] T56 [ ] T80 [ ] T81 [ ] T83 | G4C |
| 4D · Desktop app | [ ] T82 [ ] T42 [ ] T51 [ ] T84 | G4D |
| 5 · Release | [ ] T52 [ ] T53 [ ] T54 [ ] T55 | G5 = v1.0.0 |

---

## Wave 0 · CI/CD and security tests (before any feature)

T01 → (T02 ‖ T03 ‖ T04 ‖ T05) → T06 → T07

### T01 · Repo skeleton and conventions
- **Owns:** root files, `packages/` (empty), `.github/pull_request_template.md`
- **What:**
  - npm workspaces (`apps/*`, `services/*`, `packages/*`), `tsconfig.base.json` in strict mode, and **Biome** for lint and formatting (instead of ESLint and Prettier)
  - `.npmrc` with `ignore-scripts=true` and `engine-strict`. `.nvmrc` (22). `.editorconfig`
  - `.gitignore`: node_modules, dist, `.env*` except `.env.example`, `backups/`, `data/`, coverage
  - commitlint + simple-git-hooks. A PR template with the SECURITY.md §6 checklist
  - Biome rules: `noDangerouslySetInnerHtml`, `noExplicitAny`, `noConsole`, `noDefaultExport`, `noFloatingPromises`, kebab-case file names, and a ban on `exec` from `node:child_process`
  - Custom GritQL rules (`biome-plugins/`): a ban on `shell: true`, and a ban on template strings with values inside `query(` or `execute(`
  - `scripts/check-language.ts`: fails on Hebrew in any file except UI translation files
  - An initial `README.md` in English: what it is, architecture, status and how to get started. T55 expands it
- **Done when:**
  - [ ] `npm ci && npm run check` pass
  - [ ] A commit with a non-conventional message is blocked

### T02 · Secrets and commit protection
- **Owns:** `scripts/setup.ts`, `.env.example`, `.gitleaks.toml`, the pre-commit hook
- **What:**
  - `npm run setup` creates `.env` at `0600` with a DB password per service and `AGENT_TOKEN` (crypto, 32 bytes), and does not overwrite existing values
  - pre-commit runs `gitleaks protect --staged` and blocks every `.env*` file except `.env.example`
- **Done when:**
  - [ ] An attempt to commit `.env` or a string that looks like a token is blocked
  - [ ] A second run of `setup` changes nothing
  - [ ] The permission of `.env` is `0600`

### T03 · CI: quality gates ‖
- **Owns:** `.github/workflows/ci.yml`
- **What:**
  - Steps: `npm ci`, lint, typecheck, unit tests with coverage (a threshold of **80%** for `services/*/src/domain` and `apps/agent/src/core`, 60% for everything else), and build
  - commitlint on every commit in the PR (independent of local hooks)
  - `permissions: contents: read`, `concurrency`, a timeout for every job. Every action pinned to a SHA
- **Done when:**
  - [ ] CI is green
  - [ ] Dropping coverage below the threshold fails CI

### T04 · CI: security gates ‖
- **Owns:** `.github/workflows/security.yml`, `.github/dependabot.yml`, `.github/codeql/`
- **What:** every tool from SECURITY.md §4. All of them are blocking. SARIF reports are uploaded to the Security tab. Dependabot for npm, docker and actions, weekly. A nightly cron
- **Done when:**
  - [ ] A dummy PR with a secret, with `shell:true` or with a vulnerable dependency **fails**. The PR documents that this was checked
  - [ ] actionlint is clean

### T05 · Security test infrastructure ‖
- **Owns:** `tests/security/`, `scripts/security-todo.ts`
- **What:**
  - A vitest suite in which every ST01–ST18 from SECURITY.md §3 appears, each in its own file
  - **ST01 and ST02 are active right away:** ST01 parses `docker compose config --format json` and checks the policy
  - The rest are defined as `it.todo('…', { owner: 'T19' })`
  - `npm run security:todo` prints a list by task, and fails with `--strict`
  - The tests run in CI on every PR
- **Done when:**
  - [ ] Adding `ports: ["4712:4712"]` or removing `read_only` in compose fails ST01

### T06 · CD: release
- **Depends on:** T03, T04, T05
- **Owns:** `.github/workflows/release.yml`, `.github/workflows/main.yml`
- **What:**
  - **On push to main:** `docker compose up` on the runner, and smoke and security tests against the running compose
  - **On a `v*.*.*` tag:**
    - `npm run security:todo --strict` (no todo left)
    - Build the images
    - Push to GHCR as a private package
    - A GitHub Release with a changelog from the commits, the source archive, and a `docker-compose.release.yml` pinned to digests
  - No secrets other than `GITHUB_TOKEN`, with minimal `permissions` for every job
- **Done when:**
  - [ ] A `v0.0.1` tag on the skeleton produces a release


### T07 · GitHub repo protection
- **Depends on:** T06
- **Owns:** `scripts/github-protect.sh`, `docs/REPO-SETTINGS.md`
- **What:**
  - A `gh api` script that configures: a private repo, branch protection for `main` (PR required, all checks required, resolving every review thread required, linear history, no force push and no deletion. No required approval, because this is a single account and approval happens through the `Verdict` line), automatic deletion of branches after merge, secret scanning, push protection, Dependabot alerts, and Actions from an allowlist only
  - **The coordinator runs the script only after the user's explicit approval**
- **Done when:**
  - [ ] After running it, a direct push to main is rejected

**Gate G0:**
- [ ] CI, security and CD are green on the skeleton
- [ ] A v0.0.1 release
- [ ] ST01 and ST02 are active, and the remaining tests are registered as todo with owners

---

## Wave 1 · Contracts and infrastructure (5 in parallel)

### T08 · Contracts (`packages/shared`)
- **Owns:** `packages/shared/`
- **What:**
  - zod schemas for every payload in SPEC §5, a file per domain: ingest, sessions, reports, battery, system, focus, settings, alerts
  - **Route map** (`routes.ts`): method, path, auth, req and res for every endpoint under `/v1`. ST03 and ST08 are derived from it
  - Fixtures and MSW handlers for every route, so the web can work without a backend
  - i18n keys for alerts
- **Done when:**
  - [ ] Every route in the SPEC appears in the route map
  - [ ] There are tests for valid and invalid parsing

### T09 · service-kit ‖
- **Owns:** `packages/service-kit/`, `docker/Dockerfile.service`
- **What:**
  - `createService()`: Fastify, pino with redaction (A11), zod config, a `/health` that also checks the DB, a pg pool with the service's user, node-pg-migrate, automatic validation of req and res against the contract, graceful shutdown
  - A multi-stage Dockerfile: base pinned to a digest, `USER node`, a rootfs that works read-only, and `HEALTHCHECK`
  - Enables: **ST11**
- **Done when:**
  - [ ] A dummy service starts read-only as non-root

### T10 · Compose and Postgres ‖
- **Owns:** `docker-compose.yml`, `infra/postgres/`, `services/*/compose.yml` (stubs only)
- **What:**
  - `x-service-defaults` with `read_only`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `tmpfs`, `mem_limit`, `cpus` and `restart`
  - A `core` network with `internal: true`, and an `edge` network for the gateway and web only
  - Postgres 16 pinned to a digest. An init script that creates a role and schema per service from `.env`, a `REVOKE` on public, and restricts each role to its own `search_path`
  - `include:` for every service as stubs. Ports: only `127.0.0.1:4710` and `127.0.0.1:4711`
  - Enables: **ST16** (as an integration test)
- **Done when:**
  - [ ] ST01 is green
  - [ ] `ss -tln` shows only 4710 and 4711, both on 127.0.0.1

### T11 · Web skeleton ‖
- **Owns:** `apps/web/` (except `apps/web/src/pages/*` and `apps/web/src/components/*`)
- **What:**
  - Vite, React, TS, TanStack Router (routes collected from `pages/*/route.tsx` by glob), TanStack Query, and an API client built from the contracts
  - react-i18next with namespaces, and `dir` and `lang` on `<html>`
  - A system, light or dark color theme (only the mechanism, no tokens)
  - MSW in dev mode
  - nginx-unprivileged with a strict CSP and security headers
  - A lint rule banning physical CSS (left, right, etc.)
  - Enables: **ST07** (the web part)
- **Done when:**
  - [ ] Switching the language flips the UI direction
  - [ ] No CSP errors in the console

### T12 · Agent skeleton ‖
- **Owns:** `apps/agent/src/core/`, `apps/agent/package.json`
- **What:**
  - Scheduler, config, a JSONL buffer with a 50MB cap, directories at `0700` and files at `0600`
  - pino with redaction
  - A uniform interface for collectors and actuators (a registry loaded by directory)
  - Enables: **ST11** (agent), **ST15** (state)
- **Done when:**
  - [ ] There are tests for the buffer
  - [ ] Permissions are checked in a test

**Gate G1:**
- [ ] `docker compose up -d` starts and every container is healthy
- [ ] The web runs on MSW
- [ ] ST01, ST02, ST07 (web), ST11, ST15 and ST16 are green

---

## Wave 2 · Independent units (up to 5 in parallel out of 14)

Each service owns `services/<x>/` (including its `compose.yml`). Each collector owns `apps/agent/src/collectors/<x>/`.

### T13 · sessions-service
- **What:**
  - Merging samples into sessions: a gap of more than 15 s or idle closes a session
  - `apps`, `sessions` and `category_rules` tables, with default rules and reapplication over 30 days
  - API per the SPEC
  - Enables: **ST12**
- **Done when:**
  - [x] There are tests: a continuous run, an app switch, a gap, idle, out-of-order samples, and rule priority

### T14 · reports-service
- **What:** rollups, focus streaks, and the weekly summary. Enables: **ST12**
- **Done when:**
  - [x] There is a test for a rollup that crosses midnight

### T15 · goals-service (removed)
- **What:** CRUD, `/evaluate` with one alert per goal per day, and `/progress`.

### T16 · battery-service
- **What:** samples, daily, health, time remaining, `power-by-app` and alerts. Enables: **ST12**
- **Done when:**
  - [x] There are tests for the health calculation and for per-app power attribution

### T17 · system-service
- **What:** incidents with a 15 s threshold, culprits, memory leaks, and critical for OOM. Enables: **ST12**
- **Done when:**
  - [x] There are tests: a short spike does not open an incident, and sustained load opens exactly one incident

### T18 · focus-service
- **What:** state, profiles (including "mute new apps"), exceptions, schedules, `alert_policy`, `/route`, rate limit, queue, a summary on exit, and known-apps. Enables: **ST12**
- **Done when:**
  - [x] There are tests for the table of 3 levels × in focus/not in focus, for the rate limit, for the summary and for exceptions

### T19 · Gateway: core and security
- **Owns:** `apps/gateway/src/core/`, `apps/gateway/compose.yml`
- **What:**
  - Bearer for the agent with `timingSafeEqual`
  - A session cookie with a CSRF token
  - A Host allowlist and Origin check, CORS, rate limit, body limit, helmet/CSP
  - Route autoload
  - A service client with a 3 s timeout and a partial (degraded) response
  - Validation of every req against the contract
  - Enables: **ST03–ST10**
- **Done when:**
  - [x] Every ST test owned by T19 is green

### T20 · Collector: active window
- **What:** Window Calls over D-Bus. If the extension is missing: a warning, no crash

### T21 · Collector: idle and lock
- **What:** IdleMonitor, and a screen lock that stops all sampling

### T22 · Collector: battery
- **What:** reading `/sys/class/power_supply`, and automatic disabling when there is no battery

### T23 · Collector: load and processes
- **What:** PSI, and a process snapshot only under load. **Only `comm`**. Enables: **ST17** (cmdline)
- **Done when:**
  - [x] The overhead is measured in a test

### T24 · Collector: temperature and cgroup
- **What:** thermal and throttling. Mapping to a container through cgroup, **without the docker socket** by default

### T25 · Collector: app discovery
- **What:** inotify on `.desktop` directories, gsettings monitor, computing the notification-id, and Chrome apps as separate apps
- **Done when:**
  - [x] A new install is detected within 5 s

### T26 · Web: tokens and components
- **Owns:** `apps/web/src/theme/`, `apps/web/src/components/`, `apps/web/src/pages/dev-components/`
- **What:**
  - Tokens exactly as in DESIGN.md, and every component from DESIGN.md
  - A `/dev/components` page in both modes and both languages
  - A CI check that there are no hex values outside `apps/web/src/theme/color-tokens.ts`

**Gate G2:**
- [x] Every service is healthy
- [x] Contract tests: every service response is validated against the contract
- [x] ST03–ST12, ST16 and ST17 are green

---

## Wave 3 · Integration (up to 5 in parallel out of 15)

### Gateway (each task owns `apps/gateway/src/routes/<domain>/`)
- **T27 · Ingest flow:** splitting to the services, closed sessions to reports, collecting alerts, focus `/route`, and a `{notify, mute}` response. An integration test against compose. Enables: **ST08** (ingest)
- **T28 · Dashboard, reports, apps and rules routes:** including the `today` aggregation. Enables: **ST08**
- **T29 · Battery and system routes:** including passing the session timeline to `power-by-app`. Enables: **ST08**
- **T30 · Focus routes:** start and stop, mute and restore commands, and known-apps. Enables: **ST08**
- **T31 · Settings:** the `gateway.settings` schema (language, color theme, privacy, thresholds, system apps, quiet hours). Enables: **ST08**

### Agent (each task owns `apps/agent/src/actuators/<x>/` or `apps/agent/src/sender/`)
- **T32 · Sending:** a batch every 60 s, backoff, deletion only after a 2xx, and handling the response
  - **Done when:** [ ] Shutting down Docker for an hour loses no data
- **T33 · Notifier:** D-Bus Notify with urgency, translated text (`apps/agent/src/i18n/`), and an "Open dashboard" action
- **T34 · Safe muter:** execFile, an app-id regex, a system-app allowlist, and saving and restoring state. Enables: **ST14**
  - **Done when:** [ ] After `kill -9` in the middle of focus, everything is restored

### Web (each task owns `apps/web/src/pages/<x>/` and its own namespace)
- **T35 · Today:** Enables: **ST13** (XSS in a title)
- **T36 · Apps and rules:** including a preview of "what the rule applies to"
- **T37 · Goals** (removed)
- **T38 · Battery:** trend, cycles, "what is draining my battery", and time remaining
- **T39 · System:** a chart synced with the app timeline, incidents, recurring culprits and thresholds
- **T40 · Focus mode and alerts:** profiles, apps with a "new" tag, exceptions, schedules, an alert center, FocusBanner, and the level policy
- **T41 · Settings:** language, color theme, privacy, thresholds, system apps and quiet hours

**Gate G3:**
- [ ] **Manual E2E:** a real agent → the data appears on the "Today" page
- [ ] Focus mutes Telegram, and after stopping it is restored
- [ ] Every page is checked in Hebrew, in English, in light and in dark
- [ ] ST08, ST13 and ST14 are green

---

## Wave 4 · DeskPulse (replaces the old wave 4)

The product became DeskPulse (SPEC.md, DESIGN.md). Wave 4 runs as four sub-waves, each with its own gate and its own coordinator session. Workers run on Sonnet, reviews on Opus; at most 3 agents at a time. Tasks marked **[security]** get a security review too.

Dropped from the old plan (their issues are closed): T44 GNOME "Do Not Disturb", T45 automatic focus, T46 Pomodoro, T48 export and backup, T49 visible retention (replaced by T65), T50 tray icon, T59 Settings absorbs alert levels (there are no alert levels now).

### 4A · Fix and trim
Open items first: merge #202 (never mute system apps, with a security review) and fix #200 (one agent instance). **T60 runs alone and first**, because it touches every package; the rest run in parallel after it. T61–T63 change `packages/shared`, so each ships its contract change as a small PR first.

- **T60 · Rename to DeskPulse in code:** packages `@yoman/*` → `@deskpulse/*`, the compose project, containers and images, env vars, the session cookie, DB names and roles, the CLI, systemd units, state and config paths, i18n strings, README and scripts. Existing local state (`~/.config/yoman`, `~/.local/state/yoman`, the Postgres volume) is migrated once on first start and never lost. Owns: everything it renames; nothing else runs during it
  - **Done when:** [ ] `grep -ri yoman` finds only the migration code and the changelog [ ] an existing install keeps its data after the upgrade
- **T61 · Remove categories and rules:** the `category_rules` table, category fields, the rules API, category charts and the category click in the web. A migration drops the data. Owns: `services/sessions/src/` (rules), `services/reports/src/` (categories), the gateway's rules routes, the web's category UI
- **T62 · Remove window titles:** the agent stops reading titles; sessions, the gateway, settings and the web drop them; a migration deletes every stored title. Enables: **ST17** (titles part), updates **ST13** to app and process names. Owns: the window collector, the title fields in sessions and settings
- **T63 · One alert rule, lock only:** remove idle detection (keep lock), the alert-level policy and its UI, the rate-limit settings, focus schedules and Pomodoro leftovers (#182), and the Apps page. Focus routing becomes the fixed rule in SPEC §5 (focus). Owns: `services/focus/src/` (policy, schedules), the idle collector, the web's alert-policy and apps pages
- **T64 · Security test stubs:** ST19–ST24 as `it.todo` with their owners, and ST15 without the backups case. Owns: `tests/security/`
- **T65 · Silent retention:** a nightly job per service deletes raw samples older than 90 days and keeps rollups and summaries; a log line says how much was deleted. Owns: `services/*/src/jobs/retention.ts`

**Gate G4A:** [ ] #202 and #200 merged [ ] no categories, titles, idle, alert levels or Apps page left in code or UI [ ] `npm run security:todo` lists only ST19–ST24 owners

### 4B · Design system, shell and existing pages
T66 and T68 first (in parallel), then T67 and T57, then the pages.

- **T66 · Theme:** DESIGN.md as code: the ten palettes and derived tokens in `color-tokens.ts`, Heebo + Inter, radii, elevation, motion, `prefers-reduced-motion`, the static background and glass surfaces, and a test that every palette's text pairs pass 4.5:1. Owns: `apps/web/src/theme/`
- **T68 · Layouts and appearance settings API:** `GET/PUT/DELETE /v1/layouts/<page>` with the Zod schema from SPEC §5 (unknown widget IDs dropped on read), and palette and theme in the settings. Owns: `packages/shared/src/layouts/`, `apps/gateway/src/routes/layouts/`
- **T67 · Widget grid engine:** react-grid-layout with 4 and 2 column breakpoints; the widget registry (catalog, default layout per page, views, options); edit mode (drag, resize, ⋯ menu, add drawer, undo toast, reset, cancel, keyboard); content-aware sizing; per-widget loading, error and unavailable states; saving through T68. Owns: `apps/web/src/widgets/` (engine and registry, not the widget bodies)
- **T57 · Shell (redone):** the sidebar with the brand row and collapse button, the icon rail with tooltips, Settings at the bottom, routes for the six pages and Settings, redirects from old paths, skeleton loading, the state banners, and the small-window behaviour. Owns: `apps/web/src/app/`, `apps/web/src/router/`, `apps/web/src/pages/*/route.tsx`
- **T43 · Time page (redone):** the Time widgets (week by day with last week, by app, focus this week) on the reports API. Owns: `apps/web/src/pages/time/`, its widget bodies
- **T58 · Performance page (redone):** slowdowns in plain words with the culprit (#189), heat and memory, battery detail, and the power widget (read-only until T77). Owns: `apps/web/src/pages/performance/`, its widget bodies
- **T69 · Focus page:** start focus, last focus, profiles as readable lists (#196), alerts that waited, the focus banner and the focus-end summary dialog. Owns: `apps/web/src/pages/focus/`
- **T47 · Pause (reduced) and Settings page:** pause and resume tracking end to end (agent, gateway, web), and the Settings page: language, theme, palette picker, pause, start at login (wired in T42), never-mute apps. Owns: `apps/web/src/pages/settings/`, the agent's pause state

**Gate G4B:** [ ] every page except Control, Processes and Maintenance matches the design canvas in he/en, light/dark, wide and small [ ] layouts survive a reload [ ] palette contrast test green

### 4C · Control center
T72, T73 and T74 first (the channels), then the collectors, then the pages.

- **T72 · Command channel [security]:** the gateway's command queue (`POST /v1/commands`, single-use IDs, 30 s TTL), the agent's long poll and result reporting, the closed Zod union from SPEC §4.3, the result on the web's stream, and the end-app actuator with PID + start-time checks. Enables: **ST19**, **ST21**
- **T73 · Live mode:** `GET /v1/live` (SSE), `liveMode` for the agent while a visible client is connected, 2 s live samples (CPU, memory, network, processes, Docker) relayed and not stored, stop 10 s after the last client leaves. Updates SPEC §4.6 numbers if measured otherwise
- **T74 · Capabilities:** the agent detects and reports them; the gateway stores them; the web hides unsupported widgets
- **T75 · Machine collectors:** disk (statfs), network and internet (NetworkManager, byte counters), uptime → `system` `machine_state` and `connectivity_events`; disk alerts at 85% and 95%; the needs-attention list (`GET /attention`)
- **T76 · Updates and startup apps [security]:** the apt and snap reader (execFile, read-only), "open Software Updates", the autostart reader, and the startup-app actuator (user overrides only). Enables: **ST22** (startup part)
- **T77 · Power profile and charge limit [security]:** power-profiles-daemon read and switch; the charge-limit rule installed once with consent and the actuator. Enables: **ST22** (charge part)
- **T78 · Cleanup [security]:** measure categories and per-app caches, folder sizes on demand, and the delete actuator with the allowlist, realpath and no-symlink rules. Enables: **ST20**
- **T79 · Docker [security]:** status from the socket only with existing access, and the stop, start, remove and prune actions with DeskPulse's own objects protected. Enables: **ST23**
- **T56 · Processes page:** the task manager on live data with All/Apps/Docker, search, sorting, End with confirmation and the containers. Design: #136. Owns: `apps/web/src/pages/processes/`
- **T80 · Control page:** the Control widgets and the needs-attention list linking to the page that fixes each item. Owns: `apps/web/src/pages/control/`
- **T81 · Maintenance page:** disk space, cleanup with the confirmation dialog (per-app cache choice, trash files, "can't be undone"), updates and startup apps. Owns: `apps/web/src/pages/maintenance/`
- **T83 · Onboarding:** the first-run steps (welcome, Window Calls, start at login, charge limit when supported) and the empty state. Owns: `apps/web/src/onboarding/`

**Gate G4C:** [ ] every action needs a confirmation and is refused by the agent outside the allowlist [ ] ST19–ST23 real [ ] the agent stays inside SPEC §4.6 with the window closed

### 4D · The desktop app
- **T82 · Tauri desktop shell [security]:** the window on `http://127.0.0.1:4710` with no IPC, single instance, `deskpulse://` links from notifications to a confirmation dialog, and the "services aren't running" page with Retry and Start. Design: #157. Enables: **ST24**
- **T42 · systemd and autostart:** the agent's user unit, the app's autostart entry from the Settings switch, and the Window Calls check
- **T51 · CLI:** `status`, `pause`, `resume`, `focus`, `focus stop`, `uninstall` (SPEC §4.7). Owns: `apps/agent/src/cli/`
- **T84 · Packaging:** a `.deb` for the desktop app and the agent, and the release workflow builds it on a `v*` tag

**Gate G4D:** [ ] a clean Ubuntu VM: install, onboarding, every page, uninstall leaves nothing behind [ ] `npm run security:todo` shows nothing

---

## Wave 5 · Release

- **T52 · E2E:** Playwright against compose with a mocked agent: every page, both languages, both modes, two palettes, edit mode and every confirmation dialog; plus one tauri-driver smoke test of the desktop shell
- **T53 · Battery budget:** a script that measures, over one hour, the agent's CPU and RSS with the window closed and open (live mode), the containers' idle use, and the web's cost with the glass surfaces. **Fails if SPEC §4.6 is exceeded**
- **T54 · Full security review:**
  - A separate agent goes through all of SECURITY.md
  - Manual attack attempts: DNS rebinding, CSRF from another site, access from the LAN, forged and replayed commands, cleanup path tricks, PID reuse, a malicious `deskpulse://` link, and XSS in an app name
  - `docker inspect` for every container
  - A report in `docs/security-review-v1.md`. Every finding gets a fix or a documented decision
- **T55 · Detailed English README (for the portfolio):** an opening paragraph, screenshots and a GIF in both modes, both languages and a few palettes, an architecture diagram, engineering decisions (short ADRs in `docs/adr/`), security, CI/CD, installation from scratch, troubleshooting

**Gate G5:**
- [ ] `security:todo --strict` passes
- [ ] All CI is green
- [ ] A `v1.0.0` tag → a release with the images and the desktop package

---

## Coverage matrix: every requirement → task

| Requirement | Tasks |
|---|---|
| Active app tracking (no titles) | T20, T13, T27, T62 |
| Screen lock stops time and sampling | T21, T13, T63 |
| Time by app, day and week, compared with last week | T14, T43 |
| Focus streaks and focus summaries | T14, T18, T69 |
| Battery health, cycles, time left, what drains it | T22, T16, T29, T58 |
| "Battery almost empty" always alerts | T16, T63 |
| Slowdowns in plain words and the culprit app | T23, T17, T29, T58 |
| Temperature, fan, throttling, memory leaks | T24, T17, T58 |
| Live dashboard while the window is open | T73, T80, T56 |
| Disk usage and alerts | T75, T80, T81 |
| Cleanup with confirmation | T72, T78, T81 |
| Pending updates (read-only) | T76, T81 |
| Startup apps | T72, T76, T81 |
| Power profile and charge limit | T72, T77, T58, T83 |
| Task manager and End app | T23, T72, T73, T56 |
| Docker status and actions | T79, T56 |
| Internet state and uptime | T75, T80 |
| Needs-attention list | T75, T80 |
| Desktop notifications, held during focus | T33, T27, T63 |
| Focus: manual, duration, until a time, profiles | T18, T30, T40, T51, T69 |
| Per-app muting, never mute system apps, restore after a crash | T18, T34, T41, #202 |
| Automatic discovery of new apps | T25, T18 |
| Widget grid, edit mode, per-page layouts | T67, T68, every page task |
| Capabilities hide unsupported widgets | T74, T67 |
| Six pages and Settings, sidebar and rail | T57, T43, T58, T56, T81, T69, T47, T80 |
| Hebrew and English, RTL and LTR | T08, T11, every web page |
| Light, dark and system; ten palettes | T66, T47 |
| Onboarding and states | T57, T83 |
| Pause tracking | T47, T51 |
| Silent 90-day retention | T65 |
| Local buffer (Docker down) | T12, T32 |
| Battery budget | T21, T23, T73, T53 |
| Desktop app, single instance, links | T82, T84 |
| systemd, autostart, CLI, uninstall | T42, T51 |
| Healthchecks | T09, T10 |
| Only 2 ports on 127.0.0.1 | T10, ST01 |
| No secrets in git | T02, T04, T07, ST02 |
| Actions only through confirmed, re-validated commands | T72, ST19–ST24 |
| CI/CD with tests and strict security | T03–T07, T52 |
| README | T55 |
