# DeskPulse: specification

> A calm control center for your Linux desktop: how busy the computer is, what is running, what to clean up or update, where your time went, and quiet when you need it.
> Runs locally only. No data ever leaves the computer.

DeskPulse was called Yoman until wave 4. The code was renamed in T60; an existing install is migrated by `npm run migrate:yoman` and the agent's first start (see the README).

---

## 1. Goals

| # | Goal |
|---|---|
| G1 | See the state of the computer at a glance: load, memory, disk, battery, internet, uptime, and what needs attention |
| G2 | Know why the computer is slow, in plain words, and which app is to blame |
| G3 | See and control what is running: apps, processes and the user's Docker containers |
| G4 | Keep the computer tidy: disk usage and cleanup, pending updates, startup apps |
| G5 | Know where the time went, by app, without entering anything by hand |
| G6 | A focus mode that holds notifications for a set time and summarizes what waited |
| G7 | A desktop app in Hebrew and English, light and dark, with ten color palettes and a layout every user can arrange |

### Principle
Convenient for the user, like a control center: every page answers one question, plain language comes first, and every page can be rearranged.

### Non-goals
- No cloud, no accounts, no sync between computers, and no external network calls (no speed test, no update servers)
- No Windows or macOS support in the first version
- No screenshots, no keylogging, and no window titles
- No installing updates (DeskPulse lists them and opens the system's updater), and nothing that needs root after the one-time charge-limit setup

---

## 2. Target environment

| Item | Value |
|---|---|
| OS | Ubuntu and Debian-based distributions, GNOME on **Wayland** |
| Node | 22 LTS |
| Docker | Docker Engine + Compose v2 (**not** Docker Desktop, which uses more battery). DeskPulse never adds the user to the `docker` group |
| GNOME extension | **Window Calls** (required for time tracking; the rest of the app works without it) |
| Desktop app | Tauri v2 (WebKitGTK) |
| Updates sources | apt and snap (Flatpak later) |

---

## 3. Architecture

```
 on the host                                   docker compose · internal network "core"
┌──────────────────────────┐
│ DeskPulse app (Tauri)    │  window → http://127.0.0.1:4710
│ single instance, links   │                 │
└──────────────────────────┘                 ▼
┌──────────────────────────┐          ┌────────────┐
│ web (React)  :4710       │──HTTP───▶│  gateway   │ 127.0.0.1:4711
└──────────────────────────┘   SSE    └─────┬──────┘
┌──────────────────────────┐   ▲            │ routes and orchestrates
│ agent                    │───┘ ingest,    ├──────┬──────┬────────┬───────┐
│ collectors · actuators   │  commands      ▼      ▼      ▼        ▼       ▼
│ buffer · cli             │◀── (long poll) sessions reports battery system focus
└──────────────────────────┘                └──────┴──┬───┴────────┴───────┘
                                                  ┌───▼────┐
                                                  │postgres│ one schema per service
                                                  └────────┘
```

### Principles
1. **Only the gateway talks to the outside world.** The web, the agent and the desktop app know only the gateway. Services never talk to each other directly: the gateway orchestrates every flow. The only data the gateway owns is the settings (`gateway.settings`) and the short-lived command queue.
2. **Each service owns its data:** its own Postgres schema and its own DB user. Reading another service's schema is not allowed.
3. **The agent runs on the host, not in Docker**, because it needs D-Bus, `/proc`, `/sys` and the user's files. It never listens on a port: it only calls the gateway.
4. **Ports:** only `4710` (web) and `4711` (gateway), both on `127.0.0.1` only.
5. **Resilience:** the agent buffers samples locally and sends them when the gateway is available. Docker can be stopped without losing data.
6. **Actions are confirmed in the UI and executed by the agent.** The web never runs anything on the host; it asks the gateway, which queues a command the agent picks up and re-validates (§4.3).

### Flows the gateway orchestrates
| Flow | Steps |
|---|---|
| **ingest** (from the agent, every 60 s) | The gateway splits the batch: window and lock samples → `sessions`, battery → `battery`, pressure, processes, thermal and machine state (disk, network, uptime, updates, startup apps, Docker) → `system`. Closed sessions go on to `reports`. Events to alert on go through `focus`, which decides deliver now or hold, and the decisions return to the agent in the response |
| **dashboard** (per page) | The gateway calls the services a page's widgets need, in parallel, and returns one response with `degraded` for any service that did not answer |
| **live** (while the window is open) | The web opens `GET /v1/live` (SSE). While at least one visible client is connected, the gateway sets `liveMode` for the agent, which sends a live sample every 2 s; the gateway relays it to the stream without storing it |
| **command** (an action the user confirmed) | web → gateway `POST /v1/commands` → queue → agent long poll `GET /v1/agent/commands` → agent re-validates and runs → `POST /v1/agent/commands/<id>/result` → the web sees the result on the stream |
| **capabilities** (from the agent, on start and on change) | The agent reports what this computer supports (§4.5). The gateway stores it with the settings and the web hides widgets the computer cannot support |
| **known apps** (from the agent, on start and on change) | gateway → `focus` `POST /known-apps`, so focus profiles can mute them |
| **focus start/stop** | gateway → `focus` (state and profile) → mute and restore commands back to the agent |

---

## 4. The agent (on the host)

### 4.1 Collectors
| Collector | Source | Frequency | Notes |
|---|---|---|---|
| window | D-Bus Window Calls: `List` → the window with `focus=true` | 5 s | `wm_class` and `pid` only. **Titles are never read or stored.** The app ID is `wm_class` with each run of disallowed characters replaced by `-` (case kept, at most 128) |
| lock | D-Bus `org.gnome.ScreenSaver` `ActiveChanged` | Event | While locked, time stops and all sampling stops. There is no idle detection |
| battery | `/sys/class/power_supply/BAT*` | 60 s | Devices without a battery: the battery features are hidden |
| pressure | `/proc/pressure/{cpu,memory,io}` (`some`/`full avg10`) | 5 s | Very cheap |
| processes | `/proc/[pid]/{stat,status,io,cgroup}` (never `cmdline` or `environ`) | Only under load (at most every 15 s), every 5 min, and every 2 s in live mode | The top processes by CPU, RSS and IO, grouped by app. Only `comm` is sent |
| thermal | `/sys/class/thermal`, `/sys/class/hwmon`, `thermal_throttle` | 30 s | CPU temperature, fan speed when exposed, throttling |
| disk | `statfs` on `/` and `$HOME` | 10 min, and on the Maintenance page | Used and free space. Top folders are measured only on demand (a command) |
| network | NetworkManager D-Bus `Connectivity` and `StateChanged`; `/proc/net/dev` byte counters | Event; counters 60 s (2 s live) | Connected or not, disconnection history, throughput. **No external calls** |
| uptime | `/proc/uptime`, boot time | 10 min | Time since the last restart |
| updates | `apt list --upgradable`, `snap refresh --list` (execFile, read-only) | 4 times a day and on demand | Package, source and whether it is a security update. Nothing is installed |
| startup apps | `~/.config/autostart/*.desktop`, `/etc/xdg/autostart/*.desktop` (read) | inotify | Name, enabled state, and whether the entry is the user's or the system's |
| power | power-profiles-daemon D-Bus | Event | Current profile and the profiles offered |
| docker | `/var/run/docker.sock`, only when the user already has access | 60 s (2 s live) | Containers: name, image, state, health, CPU and memory. Hidden when there is no access |
| apps | inotify on `.desktop` directories + `gsettings monitor` on notification apps | Event | The known-app catalog for focus |

### 4.2 Actuators
Every actuator is reached only through a confirmed command (§4.3), except the notifier and the muter, which focus drives.

| Actuator | Implementation |
|---|---|
| notifier | D-Bus `org.freedesktop.Notifications.Notify`. An action button ("End Chrome") never acts by itself: it opens DeskPulse on the matching confirmation dialog |
| muter | `gsettings set …application/<id>/ show-banners false`, saved first and restored after focus or a crash |
| end app | `SIGTERM` to every process of the app (same uid only), then `SIGKILL` after 5 s if asked again |
| cleanup | Deletes the selected categories under the allowlisted paths (§7). Never follows symlinks and never leaves `$HOME` |
| startup app | Writes `~/.config/autostart/<id>.desktop` with `Hidden=true` (disable) or removes that override (enable). Never touches `/etc` |
| power profile | power-profiles-daemon `ActiveProfile` |
| charge limit | Writes `charge_control_end_threshold` through the udev/polkit rule installed once with consent |
| docker | `stop`, `start`, `rm` (stopped containers), `image prune` (dangling images), only with existing access. DeskPulse's own containers and images are refused |
| folder sizes | Measures the top folders of `$HOME` on demand for the Maintenance page |

**Muter safety.** The original value is saved in `~/.local/state/deskpulse/mute-state.json` before every change, and restored on startup and whenever focus has ended. An app must never stay muted after a crash.

**Never muted and never ended:** `gnome-*`, `org.gnome.*`, `org.freedesktop.*`, `io.snapcraft.*`, `update-manager`, DeskPulse itself, `desktop-security-center`, `firmware-updater`, `snapd-desktop-integration`, `snap-store`, `nm-connection-editor`, `im-config`, and every app on the user's "never mute" list. IDs are matched with dots and dashes treated alike and without case (the agent reports `org-gnome-settings`; a snap's doubled name such as `firmware-updater-firmware-updater` counts as the name). The gateway filters these out of every mute command, and the agent's muter refuses them again as a last line of defense.

**Mute new apps.** An app is new only if the focus service first saw it after the first known-apps sync. The first catalog is never new, so turning the option on does not mute everything already installed. The focus service lists each app's `firstSeenAt`; without it an app is not new.

### 4.3 Commands
- The agent long-polls `GET /v1/agent/commands` (held up to 25 s, no polling while locked).
- A command is one of a closed Zod union with two kinds:
  - **User actions**, created by the gateway only from an authenticated, CSRF-checked web request the user confirmed: `endApp`, `cleanup`, `measureFolders`, `setStartupApp`, `setPowerProfile`, `setChargeLimit`, `dockerAction`, `refreshUpdates`.
  - **System commands**, created by the gateway itself and never from a web request body: `liveMode` (from the live stream, §3), `mute` and `restore` (from focus start and stop). They change only reversible state.
- Every command gets a single-use ID and a 30 s TTL, and is dropped once delivered.
- The agent re-validates every command before acting: same uid, process identity by PID **and** start time (no PID reuse), never a system or protected app, paths only under the allowlist, Docker objects not DeskPulse's own.
- The result (`done`, `refused` with a code, or `failed`) goes back to the gateway and on to the web's stream.

### 4.4 Buffer and sending
- A local JSONL file per hour in `~/.local/state/deskpulse/buffer/`. Every 60 s a batch goes to `POST /v1/ingest`; on success the files are deleted, on failure exponential backoff up to 10 min. A 50MB cap drops the oldest files with a warning.
- Live samples are not buffered: if the gateway is down, they are dropped.
- **Known apps** and **capabilities** are not samples. Each goes to its own route at start and on change, replacing one still waiting, with a 10 s → 10 min backoff.

### 4.5 Capabilities
Reported at start and on change: Window Calls installed, battery present, charge threshold supported, power-profiles-daemon present, apt and snap present, Docker access, NetworkManager present, thermal sensors. The widget catalog and the onboarding use them.

### 4.6 Battery budget (required)
- Agent average CPU **≤ 0.5%** and memory **≤ 60MB** while the window is closed.
- Live mode (2 s) runs only while the window is open and visible, and stops 10 s after it closes, hides or is minimized.
- No polling beyond the table above. Nothing runs while the screen is locked.

### 4.7 Interfaces
- **systemd user unit** `deskpulse-agent.service` with `Restart=on-failure`. Only one agent may run at a time (a lock file).
- **CLI** `deskpulse`: `status`, `pause [dur]`, `resume`, `focus <dur|until HH:MM> [--profile name]`, `focus stop`, `uninstall`.
- **`deskpulse uninstall`** restores GNOME settings, removes the charge-limit rule (asks for the password once), removes only the autostart overrides DeskPulse created (tracked in a state file), and removes the units.

---

## 5. Services

All of them: Fastify + TypeScript, Kysely over Postgres, `GET /health`, pino logging, config validated with Zod, their own migrations.

### sessions
- **Input:** samples `{ts, appId, pid, locked}`
- **Logic:** merge consecutive samples of the same app into a session. A gap of more than 15 s or a lock closes the session
- **Entities:** `apps` (app ID, display name, icon), `sessions` (app, start, end)
- **API:** `POST /samples`, `GET /sessions?from&to`, `GET /apps`

### reports
- **Entities:** `daily_rollups` (date, app, seconds), `focus_streaks`
- **API:** `GET /day?date`, `GET /week?start` (with the previous week for comparison), `GET /top-apps?from&to`

### battery
- **Entities:** `battery_samples`, `battery_daily` (health %, cycles, average W)
- **Logic:** health = energy_full / energy_full_design. Time left from the last 30 minutes. What drains it: average power while each app is in focus (the gateway supplies the session timeline)
- **Alert:** "battery almost empty" (below 8%) always gets through, even during focus. Below 15% is held during focus
- **API:** `POST /samples`, `GET /now`, `GET /health-trend?days`, `POST /power-by-app`

### system
- **Entities:** `pressure_samples` and `process_snapshots` (7 days), `incidents` (slowdowns: type, start, end, peak, culprit app), `machine_state` (the latest disk, network, uptime, updates, startup apps and Docker snapshot), `connectivity_events`
- **Logic:**
  - A slowdown opens when `some avg10` stays above the threshold for **more than 15 s** and is described in plain words ("memory filled up", "processor was busy") with the heaviest app
  - Memory leak suspicion: an app's RSS grows by more than 1 GiB per hour
  - Temperature above the threshold or throttling, disk above the warning and critical thresholds
  - **Alert sensitivity (T85):** one setting per resource (memory, cpu, io, temperature, disk), each `low`, `normal` (default) or `high`. The thresholds per level:

    | Resource | low | normal | high |
    | --- | --- | --- | --- |
    | memory (`some avg10`) | 20% | 10% | 5% |
    | cpu (`some avg10`) | 60% | 40% | 25% |
    | io (`some avg10`) | 45% | 30% | 20% |
    | temperature | 100°C | 95°C | 85°C |
    | disk (warning / critical) | 90% / 97% | 85% / 95% | 80% / 90% |

    The gateway passes the levels with each `POST /samples`; the system service maps them to thresholds in `domain/`
  - "Needs attention" list: pending updates (security first), disk above 85%, a container down, a slowdown right now, a heavy app
- **API:** `POST /samples`, `GET /incidents?from&to`, `GET /culprits?days`, `GET /timeline?date`
- **Wave 4 API:** `GET /slowdowns?from&to` replaces `/incidents` (T58), and `GET /machine`, `GET /attention`, `GET /connectivity?days` are added (T75)

### focus
- **Entities:** `profiles` (name, muted apps, exceptions, mute new apps), `focus_sessions`, `held_alerts`, `known_apps`
- **Alert rule (fixed, no settings):** "battery almost empty" always gets through. Everything else is delivered right away outside focus and held during focus, then shown in the focus-end summary. Duplicate alerts (same key within 10 min) are dropped
- **API:** `POST /start`, `POST /stop`, `GET /state`, CRUD for `/profiles`, `POST /route`, `GET /queue`, `GET /known-apps`, `POST /known-apps`
- **Wave 4 API:** `/alert-policy` goes (T63); `GET /held` replaces `/queue`, and `POST /extend` and `GET /summary/<id>` are added (T69)

### gateway
- **Authentication:** the agent sends `Authorization: Bearer <AGENT_TOKEN>`; the web gets a session cookie through `GET /v1/session`, only from the origin `http://127.0.0.1:4710` or `http://localhost:4710` (the desktop app loads that same origin)
- **Public API (v1):** `/v1/ingest`, `/v1/dashboard/today`, `/v1/week`, `/v1/apps`, `/v1/rules`, `/v1/battery/*`, `/v1/system/*`, `/v1/focus/*`, `/v1/export`, `/v1/settings`
- **Wave 4 public API (v1):** `/v1/ingest`, `/v1/agent/commands`, `/v1/agent/commands/<id>/result`, `/v1/agent/capabilities`, `/v1/live`, `/v1/commands`, `/v1/dashboard/<page>`, `/v1/time/*`, `/v1/battery/*`, `/v1/system/*` (including `/v1/system/attention`, `/v1/system/machine`, `/v1/system/processes`, `/v1/system/docker`, `/v1/system/updates`, `/v1/system/startup`, `/v1/system/disk`), `/v1/focus/*`, `/v1/settings`, `/v1/layouts/<page>`
- The "Public API" and each service's "API" line list what exists today, and `packages/shared/test/routes.test.ts` checks them against the route map. The "Wave 4" lines are the target: each task moves the endpoints it builds onto the current line and drops the ones it removes (`/v1/rules`, `/v1/export`, `/v1/apps`, `/v1/week`, `/v1/dashboard/today`).
- **Timeouts** of 3 s per service, with a partial response `{data, degraded:["battery"]}` when one is down
- **Settings** (`gateway.settings`): language, theme (system, light, dark), palette (one of ten), tracking paused, start at login, never-mute apps, alert sensitivity per resource (T85), capabilities, and the page layouts
- **Layouts:** one key per page, `{version, widgets: [{id, w, h, view, options}]}`. Unknown widget IDs are dropped when read; deleting the key restores the default
- **Retention (silent):** raw samples older than 90 days are deleted every night by each service's job; rollups and summaries are kept. No UI
- **Security:** Host allowlist, Origin check, CSRF, rate limit and body limit. Details in [SECURITY.md](SECURITY.md)

---

## 6. The app

### 6.1 Desktop shell (Tauri)
- One window that loads `http://127.0.0.1:4710`, with **no Tauri IPC granted to that content**. The shell itself only manages the window, a single instance, and `deskpulse://` links (used by notification actions to open a confirmation dialog).
- If the web does not answer, the shell shows its own page: "DeskPulse's services aren't running", with Retry and "Start them". "Start them" runs `docker compose -f <file> up -d` with an args array, where `<file>` is the absolute path fixed at install time; it is offered only when the user already has Docker access (the same access they use to run the stack), and otherwise the page explains how to start Docker. DeskPulse never adds the user to the `docker` group.
- The browser keeps working at `http://127.0.0.1:4710` for development.

### 6.2 Web
- Vite + React 19 + TypeScript, MUI (Emotion, MUI X), TanStack Router and Query, react-hook-form, react-i18next, react-grid-layout.
- **Sidebar (in order):** Control, Time, Performance, Processes, Maintenance, Focus; Settings at the bottom. The brand row has a button that collapses the sidebar to an icon rail with tooltips.

| Page | Question | Default widgets |
|---|---|---|
| **Control** (`/`) | What's the state? | CPU, memory, disk, battery, load today, needs attention, active time today, network, focus |
| **Time** (`/time`) | Where did my time go? | Week by day (compared with last week), by app, focus this week |
| **Performance** (`/performance`) | Why is it slow? | Slowdowns today with the culprit, heat and memory (temperature, fan, leak), battery detail (health, time left, what drains it), power (profile, charge limit) |
| **Processes** (`/processes`) | What is running? | Task manager with All/Apps/Docker, search, sortable columns, End with confirmation, the user's containers |
| **Maintenance** (`/maintenance`) | What to clean or update? | Disk space, cleanup, updates (opens Software Updates), startup apps |
| **Focus** (`/focus`) | Give me quiet | Start focus (duration, profile), last focus, profiles, alerts that waited |
| **Settings** (`/settings`) | | Language, theme, palette, pause tracking, start at login, never-mute apps, alert sensitivity |

- **Widget grid:** every page except Settings is a 4-column grid of widgets with a default layout. Edit mode: drag to move with live reorder, drag the corner to resize, a ⋯ menu (view: ring, bars, line, meter, number, or the widget's detail view; size presets; widget options; remove), add from the page's catalog (click or drag), undo after remove, reset to default, cancel, and full keyboard control. A widget never cuts its content: a resize that would cut it snaps back. The full catalog and its rules are in [DESIGN.md](DESIGN.md).
- **Capabilities:** widgets the computer cannot support are hidden from the catalog and the defaults.
- **States:** skeleton loading in the shape of the real tiles; banners for missing Window Calls, services not answering (data dimmed, "data from 14:20", retry), and the agent not running; an empty state while data is still being collected; a focus banner; the focus-end summary; confirmation dialogs for every action.
- **Onboarding (first run):** welcome, Window Calls, start at login, charge limit (only when supported, with a one-time consent).
- **Small windows:** under 1100px the sidebar starts as the icon rail and the grid becomes 2 columns.
- **i18n:** `he` (default) and `en`, `dir` on `<html>`, logical properties only, dates and numbers through `Intl`. Time axes run left to right in both languages.
- **Theme:** system, light or dark, and one of ten palettes, all from the theme. See [DESIGN.md](DESIGN.md).
- **Charts:** MUI X Charts, in token colors only.

---

## 7. Privacy and security

- All data is in the Postgres volume and `~/.local/state/deskpulse`. Nothing leaves the computer.
- **No window titles** are collected, sent or stored. Process command lines are never read.
- Pause tracking in Settings and in the CLI.
- **Cleanup allowlist:** `~/.cache/*` (per app, with per-app choice), the trash (`~/.local/share/Trash`), `~/.cache/thumbnails`, and dangling Docker images when the user has access. Sizes are shown and confirmed before anything is deleted.
- **Secrets:** only in `.env` (`0600`), never in git. `npm run setup` generates random values.
- Ports listen on `127.0.0.1` only.
- **The threat model, mitigations and required security tests:** [SECURITY.md](SECURITY.md)

---

## 8. Quality, CI/CD

- **Tests:** vitest with coverage thresholds (80% for `domain` and `apps/agent/src/core`, 60% for the rest), fast-check for route fuzzing, contract tests against `packages/shared`, Playwright E2E on the web, one tauri-driver smoke test of the desktop shell, and `tests/security/` (ST01–ST24).
- **CI (every PR):** lint, typecheck, tests, build, and every security gate from SECURITY.md §4. All blocking.
- **CD:** on push to main, compose up with smoke and security tests; on a `v*` tag, images to a private GHCR, a GitHub Release with a compose file pinned to digests, and the desktop app package.
- **Nightly:** gitleaks and npm audit.
- **Healthchecks** in compose with `depends_on: condition: service_healthy`, and `restart: unless-stopped`.
