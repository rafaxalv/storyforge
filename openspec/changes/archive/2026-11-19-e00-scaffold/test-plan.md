## Automated tests

Prerequisites: Docker running and Postgres up (`docker compose up -d`, or `docker-compose up -d` with Homebrew's standalone Compose), `npm run db:migrate`. Unit tests need neither. E2E needs `npm run build` first and Playwright's Chromium (`npx playwright install chromium`).

- Command: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`
- `tests/unit/framework.test.ts` → 31 dimensions numbered 1–31, groups A–G, `LANGUAGE_SENSITIVE`, `SCENE_LEVEL` (E00/US-5)
- `tests/unit/ai-client.test.ts` → FakeClaude replays a fixture; missing fixture throws `MissingFixtureError` with no network call; path-like feature/fixture names rejected; `getClaude()` defaults to fake (E00/US-5)
- `tests/unit/env.test.ts` → invalid env reports variable names only, never values (security: fail closed, no leak)
- `tests/unit/log.test.ts` → `module: storyforge:<name>`; request id from the request context; redaction of cookie / authorization / apiKey / password → service-health / "Log level switch" (`warn` drops info lines)
- `tests/unit/request-boundary.test.ts` → service-health / "Incoming id is reused", "Missing or malformed id is replaced" (missing, 65 chars, bad characters, log-injection attempt), "Successful request logged" (exactly one `request` line; no cookie, authorization, body, query); generic 500 body with details only in the log
- `tests/unit/health-unreachable.test.ts` → service-health / "Database unreachable" (503, body only `version` + `db`, `health.db.failed` warn)
- `tests/unit/worker-failure.test.ts` → service-health / "Worker cannot reach the database" (error line, exit ≠ 0); invalid env → `env.invalid` naming only the variable
- `tests/unit/infra-policy.test.ts` → compose ports on 127.0.0.1 and digest-pinned images; Dockerfile digest-pinned base, final `USER node`, `HEALTHCHECK`, no secrets in ARG/ENV; `.dockerignore` excludes env files and `.git`; CI actions pinned to 40-char SHAs, `permissions: contents: read`, no `pull_request_target`, no `github.event` in `run:`
- `tests/integration/health.test.ts` → service-health / "Database reachable" (200 `{version, db:"ok"}`)
- `tests/integration/worker.test.ts` → service-health / "Worker starts" (`startup` role worker, then `worker.ready`; `worker.stop` and exit 0 on SIGTERM)
- `tests/e2e/smoke.spec.ts` → home page loads with an `x-request-id` header; `/api/health` 200 with the id echoed, against the production build

Result (2026-11-19): lint, typecheck, Prettier clean; `npm test` 10 files / 37 tests passed; `npm run test:e2e` 2 passed.

## Interactive cases

| ID | Scenario | Steps | Expected | Tool | Result |
|----|----------|-------|----------|------|--------|
| T1 | E00/US-1: fresh clone setup | 1. Clone the epic branch into a temp dir 2. `cp .env.example .env` 3. `docker compose up -d` 4. `npm ci && npm run db:migrate` 5. `npm run dev` | App serves the placeholder page on http://localhost:3000; steps match `doc/README.md` exactly | console | pass (2026-11-19: clean clone, `npm ci`, migrate, dev on :3600 → home 200, health `ok`; Postgres already running from the main checkout) |
| T2 | service-health: Database reachable | `curl -si localhost:3000/api/health` | `200`, body `{"version":"<pkg version>","db":"ok"}`, `x-request-id` header present | http | pass (production build) |
| T3 | service-health: Database unreachable | 1. `docker compose stop postgres` 2. `curl -si localhost:3000/api/health` 3. `docker compose start postgres` | `503`, body `{"version":…,"db":"error"}` with no error text; `health.db.failed` warn line in `logs/app.log` | http | pass (503 `{"version":"0.1.0","db":"error"}`; `health.db.failed` reason `error` on the same request id) |
| T4 | service-health: Incoming id is reused / replaced | 1. `curl -si -H 'x-request-id: abc-123' localhost:3000/api/health` 2. same with `x-request-id: bad id!` | 1: response `x-request-id: abc-123` and log lines with `requestId":"abc-123"`. 2: a new generated id in the header and logs | http | pass |
| T5 | service-health: Log level switch | Restart dev server with `LOG_LEVEL=warn`, request `/api/health` | No `request` line written; then with `LOG_LEVEL=debug` debug lines appear (static assets, `ai.client` when a feature picks the client) | console | pass (production build; after the clean-up the active Claude client is in the `startup` line as `ai`) |
| T6 | service-health: Worker starts / cannot reach DB | 1. `npm run worker` with Postgres up, then Ctrl-C 2. `DATABASE_URL=postgres://x:y@127.0.0.1:1/z npm run worker` | 1: `startup` (role worker), `worker.ready`, then `worker.stop` on Ctrl-C. 2: `worker.start.failed` error and exit code ≠ 0 | console | pass (1: startup → worker.start → worker.ready → worker.stop SIGINT. 2: covered by `worker-failure.test.ts`) |
| T7 | E00/US-4: CI | Push `epic/e00-scaffold` (with the author's OK) and open the Actions run, or run `act` locally if not pushing | lint, typecheck, unit+integration, e2e and docker build jobs all green | manual | pass (2026-11-19, run 44580097527: `check` 1m26s and `image` 56s green) |
| T8 | Packaging: image runs both roles | 1. `docker build -t storyforge:e00 .` 2. `docker run --rm -e ROLE=web -e DATABASE_URL=… --network host storyforge:e00` 3. curl health 4. same with `ROLE=worker` | Web answers `/api/health` 200 and logs JSON (production); worker logs `worker.ready`; `docker inspect` shows a non-root user and a healthcheck | console | pass (run on the compose network with `--read-only --cap-drop=ALL --security-opt=no-new-privileges`: web 200 `db:"ok"`, container `healthy`, uid 1000 `node`, no `x-powered-by`; worker `worker.ready`; `node dist/migrate.js` applies migrations. First run failed: Next tried to install TypeScript for `next.config.ts` → fixed with `next.config.mjs`) |
| T9 | Errors caught by Next.js are logged with the request id | Temporary route that throws (removed afterwards); `curl -H 'x-request-id: probe-1'` it in dev | 500; `request.error` (error, with `err`) and `request` (status 500) lines, both with `requestId` probe-1 | console | pass |

## Observability checks

- [x] `storyforge:http` emits `request` with `requestId, method, route, status, durationMs` once per request (T2, T4)
- [x] Every line written while handling a request carries the same `requestId` as the `x-request-id` response header (T3, T4, T9 — including lines from inside Next route handlers)
- [x] `storyforge:health` emits `health.db.failed` (warn) with `reason` and `durationMs` when Postgres is down (T3)
- [x] Both roles emit `startup` with `role, version, env, logLevel` (T1, T6, T8)
- [x] `storyforge:worker` emits `worker.start`, `worker.ready`, `worker.stop`, and `worker.start.failed` on DB failure (T6, unit test)
- [x] `logs/app.log` receives the same lines as stdout locally; production image writes JSON to stdout only (T1, T8)
- [x] No log line contains a cookie, authorization header, request body, query string or `ANTHROPIC_API_KEY` value (unit tests + grep of the T1–T9 log files)

## Exit criteria

- [x] Automated tests green (`npm run lint && npm run typecheck && npm test && npm run test:e2e`)
- [x] All interactive cases `pass` (T7 may be done by the human reviewer if the branch is not pushed)
- [x] Observability checks visible
- [x] Security items from design.md each covered by a passing test or case (env fail-closed, generic errors, redaction, request-id validation, non-root/digest-pinned image, SHA-pinned CI with read-only token)
- [x] No known regressions (first epic: n/a)
