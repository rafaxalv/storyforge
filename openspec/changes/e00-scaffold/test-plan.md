## Automated tests

Prerequisites: Docker running with `docker compose up -d` (Postgres healthy), `npm run db:migrate`. Unit tests need neither.

- Command: `npm run lint && npm run typecheck && npm test && npm run test:e2e`
- `tests/unit/framework.test.ts` → 31 dimensions numbered 1–31, groups A–G, `LANGUAGE_SENSITIVE`, `SCENE_LEVEL` (E00/US-5)
- `tests/unit/ai-client.test.ts` → FakeClaude replays a fixture; missing fixture throws `MissingFixtureError` with no network call; `getClaude()` defaults to fake (E00/US-5)
- `tests/unit/env.test.ts` → invalid env exits with variable names only, never values (security: fail closed, no leak)
- `tests/unit/log.test.ts` → redaction of cookie / authorization / apiKey fields; `log(name)` sets `module: storyforge:<name>`; `LOG_LEVEL=warn` drops info lines → service-health / "Log level switch"
- `tests/integration/health.test.ts` → service-health / "Database reachable", "Database unreachable" (503, body has only version and `db`)
- `tests/integration/request-id.test.ts` → service-health / "Incoming id is reused", "Missing or malformed id is replaced" (missing, 65 chars, bad characters)
- `tests/integration/request-log.test.ts` → service-health / "Successful request logged" (exactly one `request` line with requestId, method, route, status, durationMs; no cookie, authorization, body, query); generic 500 body from a failing test route
- `tests/integration/worker.test.ts` → service-health / "Worker starts" (`startup` role worker, then `worker.ready`), "Worker cannot reach the database" (error line, exit code ≠ 0)
- `tests/unit/infra-policy.test.ts` → compose ports bound to 127.0.0.1; Dockerfile `USER` non-root and `FROM …@sha256:`; every `uses:` in `.github/workflows/*.yml` pinned to a 40-char SHA; workflow `permissions: contents: read`
- `tests/e2e/smoke.spec.ts` → home page loads with `x-request-id` response header; `/api/health` 200 against the built app

## Interactive cases

| ID | Scenario | Steps | Expected | Tool | Result |
|----|----------|-------|----------|------|--------|
| T1 | E00/US-1: fresh clone setup | 1. Clone the epic branch into a temp dir 2. `cp .env.example .env` 3. `docker compose up -d` 4. `npm ci && npm run db:migrate` 5. `npm run dev` | App serves the placeholder page on http://localhost:3000; steps match `doc/README.md` exactly | console | todo |
| T2 | service-health: Database reachable | `curl -si localhost:3000/api/health` | `200`, body `{"version":"<pkg version>","db":"ok"}`, `x-request-id` header present | http | todo |
| T3 | service-health: Database unreachable | 1. `docker compose stop postgres` 2. `curl -si localhost:3000/api/health` 3. `docker compose start postgres` | `503`, body `{"version":…,"db":"error"}` with no error text; `health.db.failed` warn line in `logs/app.log` | http | todo |
| T4 | service-health: Incoming id is reused / replaced | 1. `curl -si -H 'x-request-id: abc-123' localhost:3000/api/health` 2. same with `x-request-id: bad id!` | 1: response `x-request-id: abc-123` and log lines with `requestId":"abc-123"`. 2: a new generated id in the header and logs | http | todo |
| T5 | service-health: Log level switch | Restart dev server with `LOG_LEVEL=warn`, request `/api/health` | No `request` line written; then with `LOG_LEVEL=debug` the `ai.client` debug line appears at startup | console | todo |
| T6 | service-health: Worker starts / cannot reach DB | 1. `npm run worker` with Postgres up, then Ctrl-C 2. `DATABASE_URL=postgres://x:y@127.0.0.1:1/z npm run worker` | 1: `startup` (role worker), `worker.ready`, then `worker.stop` on Ctrl-C. 2: `worker.start.failed` error and exit code ≠ 0 | console | todo |
| T7 | E00/US-4: CI | Push `epic/e00-scaffold` (with the author's OK) and open the Actions run, or run `act` locally if not pushing | lint, typecheck, unit+integration, e2e and docker build jobs all green | manual | todo |
| T8 | Packaging: image runs both roles | 1. `docker build -t storyforge:e00 .` 2. `docker run --rm -e ROLE=web -e DATABASE_URL=… --network host storyforge:e00` 3. curl health 4. same with `ROLE=worker` | Web answers `/api/health` 200 and logs JSON (production); worker logs `worker.ready`; `docker inspect` shows a non-root user and a healthcheck | console | todo |

## Observability checks

- [ ] `storyforge:http` emits `request` with `requestId, method, route, status, durationMs` once per request (T2, T4)
- [ ] Every line written while handling a request carries the same `requestId` as the `x-request-id` response header (T4)
- [ ] `storyforge:health` emits `health.db.failed` (warn) with `reason` and `durationMs` when Postgres is down (T3)
- [ ] Both roles emit `startup` with `role, version, env, logLevel` (T1, T6, T8)
- [ ] `storyforge:worker` emits `worker.start`, `worker.ready`, `worker.stop`, and `worker.start.failed` on DB failure (T6)
- [ ] `logs/app.log` receives the same lines as stdout locally; production image writes JSON to stdout only (T1, T8)
- [ ] No log line contains a cookie, authorization header, request body, query string or `ANTHROPIC_API_KEY` value (unit + grep of `logs/app.log` after T1–T6)

## Exit criteria

- [ ] Automated tests green (`npm run lint && npm run typecheck && npm test && npm run test:e2e`)
- [ ] All interactive cases `pass` (T7 may be done by the human reviewer if the branch is not pushed)
- [ ] Observability checks visible
- [ ] Security items from design.md each covered by a passing test or case (env fail-closed, generic errors, redaction, request-id validation, non-root/digest-pinned image, SHA-pinned CI with read-only token)
- [ ] No known regressions (first epic: n/a)
