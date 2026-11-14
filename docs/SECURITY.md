# DeskPulse: security and privacy

DeskPulse collects sensitive data (which apps you used and when, process lists, what is on your disk) and can act on the computer: end apps, delete caches and trash, change startup apps, the power profile and the charge limit, and manage the user's Docker containers. It never reads window titles or process command lines.

**Three goals, and only these three:**
1. **Your data never leaves the machine.** Nothing is published beyond loopback, and no container has a route to the internet.
2. **No secrets reach GitHub or anywhere else.** Tokens, passwords and real data never enter git, logs or build artifacts.
3. **DeskPulse can't be turned against the computer.** Every action runs only after the user confirms it in the UI, only through the agent, and only inside a fixed allowlist the agent checks again.

Remote takeover of the machine is out of scope. Anything that does not serve one of these goals is not gated here.

**Principle:** the gates are automated in CI. A red check blocks the merge, and there is no `continue-on-error`.

## 1. Assets
| Asset | Sensitivity |
|---|---|
| App usage history | **Very high** |
| User files in the cleanup allowlist (caches, trash) | **Very high** (deletion can't be undone) |
| The command queue (end app, cleanup, Docker) | High |
| Process lists | High (command lines can contain tokens, so they are never read) |
| `AGENT_TOKEN`, DB passwords | High |
| GNOME mute settings, autostart entries, power profile, charge limit | Medium (tampering = missed notifications or a changed system) |
| Battery and load data | Low |

## 2. Threats and mitigations

| # | Threat | Mitigation | Task | Test |
|---|---|---|---|---|
| A1 | **Secrets reach GitHub** | `.env*` in `.gitignore`, and pre-commit always blocks staged `.env*` files except `.env.example`. gitleaks runs in pre-commit when installed (best-effort locally) and in CI over the full history, where it is the enforcing gate. `npm run setup` generates random values. Only placeholders in `.env.example` | T02, T04 | ST02 |
| A2 | **API exposed to the local network** | Ports bound to `127.0.0.1` only. Internal services on an `internal: true` network | T10 | ST01 |
| A3 | **A malicious website sends requests to localhost** (CSRF) | `HttpOnly; SameSite=Strict` cookie, a CSRF token on every state-changing request, `Origin` check, CORS for 4710 only | T19 | ST05, ST06 |
| A4 | **DNS rebinding** | `Host` allowlist: only `127.0.0.1:4711` and `localhost:4711`, otherwise 421 | T19 | ST04 |
| A5 | **A local process impersonates the agent** | Bearer `AGENT_TOKEN` (32 bytes), `.env` at `0600`, comparison with `timingSafeEqual` | T02, T19 | ST03, ST15 |
| A6 | **XSS through an app name, a process name or a container name** (all external input) | React escaping only, a lint rule banning `dangerouslySetInnerHTML`, CSP `script-src 'self'` with no inline script | T11, T26 | ST07, ST13 |
| A7 | **Command injection in the muter, updates or Docker actions** | `execFile` with an args array only. app-id validated against `^[a-zA-Z0-9._-]{1,128}$`, container IDs against `^[a-f0-9]{12,64}$` | T34, T76, T79 | ST14 |
| A8 | **SQL injection** | Parameterized queries only. A lint rule banning template strings inside `query()` | T09 | ST12 |
| A9 | **A compromised service reads another service's data** | A DB user per service, with privileges on its own schema only. `REVOKE ALL ON SCHEMA public` | T10 | ST16 |
| A10 | **Container escape and egress** | non-root, `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `tmpfs: /tmp`, memory limits, no docker socket. Every service except web and gateway is only on `internal: true` networks, so no container can send data to the internet | T09, T10 | ST01, ST18 |
| A11 | **Sensitive data in logs** | pino redaction: `authorization`, `cookie`, `title`, `cmdline`, `token`, `password`, and file paths from cleanup | T09, T12 | ST11 |
| A12 | **Secrets in process command lines** | The agent sends only `comm`, never `cmdline` | T23 | ST17 |
| A13 | **Malicious dependency** (supply chain) | `npm ci`, `ignore-scripts=true`, npm audit, Dependabot, dependency-review, only popular and maintained packages, Actions pinned to a SHA, images pinned to a digest | T01, T04, T06 | CI |
| A14 | **An app stays muted after a crash** | Save state before every change and restore it on startup | T34 | T34 test |
| A15 | **docker socket = root privileges** | DeskPulse never requires or grants the `docker` group. Docker features appear only when the user already has access; containers never mount the socket | T24, T79 | ST01, ST23 |
| A16 | **A forged or replayed command** (a local process or a page tries to make the agent act) | User actions are created only by the gateway from an authenticated, CSRF-checked web request; system commands (`liveMode`, `mute`, `restore`) only by the gateway itself and never from a request body; a closed Zod union; single-use ID; 30 s TTL; delivered only to the authenticated agent | T72 | ST19 |
| A17 | **API flooding** | Rate limit: ingest once per 10 s, web 300 requests per minute. 1MB body limit | T19 | ST09, ST10 |
| A18 | **Unexpected input crashes a service** | zod at every boundary. Fuzzing for every route | T19 | ST08 |
| A19 | **The CI/CD itself is compromised** | `contents: read` permissions by default, no `pull_request_target`, actionlint, SHA-pinned actions, no stored keys | T03–T06 | CI |
| A20 | **Cleanup deletes the wrong files** (path traversal, symlinks, a race) | Only the allowlisted roots in SPEC §7; paths resolved with `realpath` and checked to stay under the root; `lstat` and never follow symlinks; `openat`-style deletion of what was measured; sizes shown and confirmed first | T78 | ST20 |
| A21 | **Ending the wrong process** (PID reuse, another user's or a system process) | Same uid only; identity = PID + start time from `/proc/<pid>/stat`; system apps, DeskPulse itself and never-mute apps refused | T56, T72 | ST21 |
| A22 | **Startup apps or the power and charge settings changed behind the user's back** | Only through confirmed commands; startup changes only as user overrides in `~/.config/autostart` (never `/etc`); the charge-limit rule is installed once with consent and allows only `charge_control_end_threshold` values 50–100 | T76, T77 | ST22 |
| A23 | **Docker actions hit DeskPulse's own stack or something else** | Only `stop`, `start`, `rm` of stopped containers and dangling-image prune; DeskPulse's compose project labels are refused | T79 | ST23 |
| A24 | **The desktop shell gives a page native powers** | The Tauri window loads `http://127.0.0.1:4710` with no IPC capabilities granted to it; `deskpulse://` links carry only an allowlisted dialog name and are parsed with Zod; the shell's one command (`docker compose -f <file> up -d`, the path fixed at install time) uses an args array and is offered only with existing Docker access | T82 | ST24 |

### Content Security Policy (web)
The web container (`apps/web/nginx/security-headers.conf`) sends this policy on every response, errors included. ST07 checks it.

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self';
connect-src 'self' http://127.0.0.1:4711 http://localhost:4711;
object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

| Directive | Why |
|---|---|
| `default-src`, `script-src`, `img-src`, `font-src` `'self'` | Same-origin files only. No inline script and no `eval`, so an injected app or process name cannot run (A6) |
| `style-src 'self' 'unsafe-inline'` | The UI is built on MUI, whose Emotion engine injects `<style>` rules at runtime, and a static nginx server cannot hand out a per-response nonce. Inline style cannot run code, `script-src` is unchanged, and React still escapes every name, so a name cannot inject markup to style in the first place (A6) |
| `connect-src 'self' http://127.0.0.1:4711 http://localhost:4711` | The page talks only to the gateway on loopback, under the two host names the gateway's `Host` allowlist accepts (A4) |
| `object-src 'none'`, `base-uri 'none'` | No plugins, and no `<base>` tag that could redirect relative URLs |
| `form-action 'self'` | Forms submit only to the web origin |
| `frame-ancestors 'none'` | No framing, so no clickjacking (with `X-Frame-Options: DENY` for older browsers) |

The other web headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` and a `Permissions-Policy` that turns off camera, microphone, geolocation, payment and USB. Any change to the policy updates this section in the same PR.

### Content Security Policy (gateway)
The gateway (`apps/gateway/src/core/security-headers.ts`) serves only JSON, so its policy allows nothing. A response that a browser is tricked into rendering as a page can load and run nothing. It is sent on every response, errors included, and ST07 checks it.

```
default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

The other gateway headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` and `Cache-Control: no-store`, because responses carry personal activity data. They come from `@fastify/helmet`: its defaults stay on except where the options in `security-headers.ts` replace them. `Strict-Transport-Security` is disabled on purpose, because the gateway speaks plain HTTP on loopback and HSTS would pin `localhost` for other apps. In development only, the OpenAPI docs under `/docs` get their own relaxed CSP (Swagger UI needs inline styles and scripts); the production gateway does not register them. Any change to the policy updates this section in the same PR.

## 3. Automated security tests (`tests/security/`)

Task T05 created ST01–ST18 as `it.todo` with the ID of the responsible task; T64 adds ST19–ST24 the same way.
**Every task listed in the "Enabled by" column must turn the todo into a real test in the same PR.**
CD fails if a single todo remains (`npm run security:todo`). That way no test can be forgotten.

| # | Test | Enabled by |
|---|---|---|
| ST01 | **Compose policy:** only 2 ports, both on 127.0.0.1. Every service is non-root, read_only, cap_drop ALL, no-new-privileges and has a memory limit. No docker.sock mount. Images pinned to a digest | T05 (active from the start) |
| ST02 | Secrets: gitleaks clean, `.env` not tracked by git, `.env.example` contains only placeholders | T05 (active from the start) |
| ST03 | **Authentication:** every route in the contracts' route map, without a token or session → 401. Derived automatically, so a new route is covered on its own | T19 |
| ST04 | Foreign Host → 421 | T19 |
| ST05 | State-changing request without CSRF or with a foreign Origin → 403 | T19 |
| ST06 | CORS: a foreign origin does not receive `Access-Control-Allow-Origin` | T19 |
| ST07 | Headers: CSP, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'` on web and gateway | T11, T19 |
| ST08 | **Fuzzing:** for every route, 50 invalid inputs (fast-check from the zod schema) → always 400, never 500 | T19 + every route task |
| ST09 | Rate limit → 429 | T19 |
| ST10 | Body larger than 1MB → 413 | T19 |
| ST11 | **Redaction:** an injected token and title do not appear in the log output, and neither does a cleanup file path | T09, T12, T78 |
| ST12 | SQL injection payloads in every parameter → no DB error and no leak | T13–T18 |
| ST13 | **XSS:** an app or process name of `<img src=x onerror=…>` is rendered as text (Playwright) | T35, T62 |
| ST14 | Muter: an app-id containing `;`, `$()` or a space is rejected, and `execFile` is called without a shell | T34 |
| ST15 | Permissions: `.env` and state files are created at `0600`/`0700` | T02, T12 |
| ST16 | Least privilege: a service's DB user cannot read another service's schema | T10 |
| ST17 | The agent never reads or sends `cmdline` or window titles | T23, T62 |
| ST18 | **No container egress:** every compose service except web and gateway is attached only to `internal: true` networks, and web and gateway have at most one non-internal network (needed for loopback publishing) | T10 |
| ST19 | **Commands:** a command without a session or CSRF → 403; a system command type (`liveMode`, `mute`, `restore`) in a web request → 400; an unknown type, a replayed ID or one past its TTL is refused by the gateway and by the agent | T72 |
| ST20 | **Cleanup:** a symlink out of the root, `..` in a path, or a path outside the allowlist is refused, and nothing outside the root is deleted (temp-dir fixture) | T78 |
| ST21 | **End app:** a PID owned by another uid, a reused PID (different start time), a system app or DeskPulse itself is refused | T72 |
| ST22 | **Startup and power:** the agent writes only under `~/.config/autostart`, and the charge rule rejects values outside 50–100 | T76, T77 |
| ST23 | **Docker:** DeskPulse's own containers and images are refused, and nothing runs without existing socket access | T79 |
| ST24 | **Desktop shell:** the window has no IPC capabilities, a malformed `deskpulse://` link is ignored, and the start command uses only the install-time compose path | T82 |

## 4. CI security gates (blocking)
| Tool | What it checks | When |
|---|---|---|
| gitleaks | Secrets across the full history and the tracked files (goal 2) | Every PR, push and nightly |
| npm audit (`--audit-level=moderate`) | Vulnerable dependencies | Every PR and nightly |
| dependency-review-action | A new dependency that is vulnerable or has a disallowed license (GPL/AGPL) | Every PR |
| CodeQL (javascript-typescript, security-extended) | Static code analysis | Every PR and weekly |
| actionlint | Mistakes in the workflows themselves | Every PR |
| Biome (`biome ci`) + GritQL rules in `biome-plugins/` | `shell:true`, `dangerouslySetInnerHTML`, template SQL, `exec`, `eval`, `any` | Every PR |
| tests/security (ST01–ST24) | Actual behavior, including the compose policy and no container egress (goal 1) | Every PR |

## 5. File permissions
| Path | Permission |
|---|---|
| `.env` | `0600` |
| `~/.config/deskpulse/` | `0700` |
| `~/.local/state/deskpulse/` | `0700`, files at `0600` |
| `~/.config/autostart/<id>.desktop` overrides | `0600` |

## 6. Checklist for every PR
- [ ] Every external input is validated with zod at the boundary (route or collector)
- [ ] No secrets, titles, file paths or tokens in logs or error messages
- [ ] Any action on the host goes through a confirmed command and is re-validated by the agent
- [ ] No `shell: true` and no command built from a string
- [ ] SQL with parameters only
- [ ] No new port, and no change to CORS, Host or CSP without updating this document
- [ ] New dependency: justified in the PR, popular and maintained, with a compatible license
- [ ] The ST tests the task enables have gone from todo to real tests
- [ ] New files are created with the permissions from the table
