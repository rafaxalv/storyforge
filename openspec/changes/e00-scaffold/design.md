## Context

The repo has only planning docs (PRD.md, ARCHITECTURE.md, EPICS.md, openspec/). ARCHITECTURE.md §2–§3 and §8–§10 fix the stack, layout, logging convention, test strategy and environments; this design records the decisions those sections leave open for the scaffold. Node 22 is installed on the author's machine (Homebrew keg, not on the shell PATH yet); Docker is not installed and is required before integration and e2e tests can run locally.

## Goals / Non-Goals

**Goals:**
- A web process and a worker process that start, log, report health and stop cleanly.
- One correlation id per HTTP request visible on every log line written while handling it, including inside Next.js route handlers.
- Test harness (unit, integration with Postgres, e2e) and CI that every later epic extends rather than reinvents.
- A Claude seam that makes real API calls impossible by accident in tests and local runs.

**Non-Goals:**
- Auth, any data model beyond an empty migration, any product UI beyond a placeholder page.
- Object-storage client code (MinIO runs in compose for later epics; first used in E03).
- Production hosting choice and deployment pipeline (the image is built in CI; deploying it is later).

## Decisions

1. **Custom Node server for the web role** (`src/server/main.ts`: `http.createServer` + Next's request handler) instead of `next start`.
   - Why: it is the only place that sees every request's start and finish, so it can run the request inside AsyncLocalStorage, set and return `x-request-id`, and write exactly one `request` line with status and duration (spec: "Every request is logged once"). Next.js middleware runs in a separate (edge-style) context, cannot see the final status, and its AsyncLocalStorage does not reach route handlers.
   - The server also copies the request id into the incoming request headers, so code that runs outside the ALS context (if Next ever moves rendering off the request's async chain) can still read it from `headers()`. The logger's mixin takes the ALS value first, then `-`.
   - Alternatives: middleware + wrapper per route handler (misses pages and statuses); OpenTelemetry auto-instrumentation (heavier, a later option).
   - Trade-off: a custom server opts out of some Next.js hosting optimisations; we deploy a container anyway (ARCHITECTURE §2).
2. **Next.js build output `standalone`**, run by the custom server in the image; `serverExternalPackages: ["pino", "pino-pretty", "pg", "pg-boss"]` so they are not bundled.
3. **Logger** (`src/server/log.ts`): one root pino logger; `log(name)` → `root.child({ module: "storyforge:" + name })`. Destinations via `pino.multistream`: stdout (JSON when `NODE_ENV=production`, pino-pretty stream otherwise) and, when `LOG_FILE` is set (default `logs/app.log` in `.env.example`), a file destination. Synchronous streams, no worker-thread transports (they break under bundling). Level from `LOG_LEVEL` (default `info`). Redaction paths for `req.headers.cookie`, `req.headers.authorization`, `*.apiKey`, `*.password`.
4. **Env validation** (`src/server/env.ts`): Zod schema parsed once at startup for both roles; missing/invalid values exit with a list of variable names (never values). `DATABASE_URL`, `LOG_LEVEL`, `LOG_FILE`, `APP_VERSION` (defaults to `package.json` version), `AI_CLIENT` (`fake` | `anthropic`, default `fake`), `ANTHROPIC_API_KEY` (required only when `AI_CLIENT=anthropic`).
5. **Database**: Drizzle ORM over a `pg` Pool (`src/server/db/client.ts`); schema in `src/server/db/schema/`; `drizzle-kit generate` → SQL migrations in `src/server/db/migrations/` (first one empty); `npm run db:migrate` applies them. Health check: `SELECT 1` with a 2 s client-side timeout.
6. **Worker** (`src/worker.ts`): validates env, starts pg-boss on `DATABASE_URL` (its own `pgboss` schema), registers no queues yet, logs `worker.start` then `worker.ready`; on start failure logs `worker.start.failed` and exits 1; on SIGTERM/SIGINT stops pg-boss gracefully and logs `worker.stop`. Dev: `tsx watch src/worker.ts`; image: bundled with esbuild to `dist/worker.js`.
7. **Claude seam** (`src/server/ai/client.ts`): an interface `ClaudeClient` with `createMessage(params, meta)` and `streamMessage(params, meta)` typed with the SDK's own `Anthropic.MessageCreateParams` / `Anthropic.Message` (no custom message types). `AnthropicClaude` wraps `@anthropic-ai/sdk`; `FakeClaude` loads fixtures from `tests/fixtures/claude/<feature>/<key>.json` where `key` = `meta.fixture` or a stable hash of the normalised params, and throws `MissingFixtureError` (never calls the network). `getClaude()` picks by `AI_CLIENT`; default `fake`. Default model constant `claude-opus-5-5`. No feature uses it yet; a unit test proves fixture replay and the missing-fixture error. SDK usage is taken from the claude-api skill's TypeScript reference during `code`, not from memory.
8. **Framework constants** (`src/shared/framework.ts`): the five tags and 31 dimensions from cowriter's voice-generator skill as a frozen typed array (number, group A–G, name, low pole, high pole), plus `LANGUAGE_SENSITIVE = [4,5,6,7,11]` and `SCENE_LEVEL = [19,20,27,28,29,30]`. Unit test checks count, numbering 1–31 without gaps, group membership.
9. **Tests**: Vitest with two projects — `unit` (`tests/unit`, node env) and `integration` (`tests/integration`, uses `DATABASE_URL_TEST`, global setup runs migrations on `storyforge_test`, created by a compose init script). `npm test` runs both; `npm run test:unit` runs unit only (no Docker needed). Playwright (`tests/e2e`) starts the built app via `webServer` (`npm run build && npm run start`) with `AI_CLIENT=fake`.
10. **Local infra**: `docker-compose.yml` with `postgres:16-alpine`, pinned by digest, port bound to `127.0.0.1`, dev-only credentials from `.env` (`.env.example` holds placeholders), named volume, healthcheck. *Changed during code (2026-11-18):* MinIO was dropped from E00 — its community images are no longer published in a form we can pin reliably, and nothing uses object storage before E03, which chooses the storage image.
13. *Added during code:* **No `output: "standalone"`** — Next's standalone output does not trace a custom server, so the image ships `.next/`, `dist/` and production `node_modules` instead. The Next config is `next.config.mjs` (plain JavaScript): Next loads it at runtime, and a `.ts` config made it try to install TypeScript inside the production container. **Next.js instrumentation** (`src/instrumentation.ts` → `src/server/request-error.ts`) logs `request.error` with the request id for errors Next catches itself in route handlers and renders; Node-only imports sit inside the `NEXT_RUNTIME === "nodejs"` branch so the edge bundle stays clean.
11. **Image**: multi-stage `Dockerfile` on `node:22-alpine` pinned by digest — deps (`npm ci`), build (Next standalone + esbuild worker), runtime with only `standalone/`, `static/`, `dist/worker.js`, migrations; non-root `node` user; `ROLE=web|worker` selects the command; `HEALTHCHECK` on `/api/health` for web. `.dockerignore` excludes `.env*`, `.git`, `logs`, `node_modules`, tests.
12. **CI** (`.github/workflows/ci.yml`): on push and pull_request; `permissions: contents: read`; every action pinned by full SHA with a version comment; Postgres service container; steps: `npm ci`, lint, typecheck, unit + integration, Playwright install + e2e, `docker build` (no push). No secrets used.

## Observability

- **Loggers**: `storyforge:http` (custom server), `storyforge:health`, `storyforge:worker`, `storyforge:db`, `storyforge:ai` (seam), `storyforge:env`.
- **Boundary lines**:
  - `startup` (info): `{role, version, env, logLevel}` — once per process.
  - `request` (info, `storyforge:http`): `{requestId, method, route, status, durationMs}` — once per request, on response `finish` (or `close` if aborted, with `aborted: true`). Route = path without query string.
  - `request.error` (error): unhandled error in the handler, with `requestId` and the error (stack only in logs, never in the response).
  - `health.db.failed` (warn): `{requestId, durationMs, reason: "timeout"|"error"}`.
  - `worker.start`, `worker.ready`, `worker.start.failed` (error, with the error), `worker.stop`.
  - `ai.client` (debug): which implementation is active; `ai.fixture.missing` (error) in FakeClaude.
  - `env.invalid` (fatal): names of invalid variables.
- **Correlation**: `requestId` on every line via the logger mixin reading AsyncLocalStorage; returned in `x-request-id`. Jobs (later epics) will carry `jobId` + originating `requestId`; the ALS store already has a `jobId` slot.
- **Switch**: `LOG_LEVEL` (`trace|debug|info|warn|error|fatal|silent`); `LOG_FILE` path or empty to disable the file.
- **Health**: `GET /api/health` (spec `service-health`); Docker `HEALTHCHECK` uses it.
- **Privacy**: no bodies, cookies, auth headers or query strings in logs.

## Security

Rule files in `.claude/rules/security/` that apply, and how:

- **owasp-2025.md**
  - A02 Security Misconfiguration: production error responses are generic (`{"error":"Internal server error"}`), no stack traces; `/api/health` returns only version and `ok|error`; Next `poweredByHeader: false`; env validated at startup (fail closed).
  - A03 Supply Chain: exact versions in `package-lock.json`, `npm ci` everywhere; Docker base images pinned by digest; GitHub Actions pinned by SHA.
  - A05 Injection / log injection: `x-request-id` accepted only if it matches `^[A-Za-z0-9_-]{1,64}$`, otherwise replaced; health query has no parameters.
  - A09 Logging: request line per request; redaction of cookie/authorization/API-key fields; no bodies.
  - A10 Exceptional conditions: health check fails closed (503) on timeout or error; worker exits non-zero when it cannot start.
- **typescript.md**: `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`; env and fixture files parsed with Zod (no type assertions on untrusted data); ESLint forbids `any` in `src/`.
- **docker.md**: minimal base (alpine) by digest, multi-stage, non-root user, no secrets in build args or layers, `.dockerignore` excludes env files, `HEALTHCHECK`; compose binds ports to 127.0.0.1. Read-only root filesystem and capability drops are deployment settings, documented in `doc/scaffold.md` for later.
- **github-actions.md**: actions pinned by full SHA, `permissions: contents: read`, no secrets, no `${{ github.event.* }}` interpolated into `run:` scripts, `pull_request` (not `pull_request_target`).
- **react.md**: placeholder page only; no `dangerouslySetInnerHTML`; nothing sensitive in client state. Fully applies from E01.
- **ai-security.md**: only the seam exists; `ANTHROPIC_API_KEY` read from env, never logged or sent to the client; default `AI_CLIENT=fake` prevents accidental calls; prompt-injection and output-validation rules apply from E08 when the first feature uses Claude.

## Risks / Trade-offs

- [Custom server diverges from Next.js defaults; framework upgrades may change the request handler API] → Keep the server under 100 lines, cover it with the e2e request-id and request-line tests, pin Next.js exactly.
- [AsyncLocalStorage context may not reach every Next.js code path] → Request id is also injected into request headers; integration test calls a route handler that logs and asserts the id; e2e asserts the response header.
- [Docker not installed locally → integration/e2e can't run during `test`] → Unit tests run without Docker; installing Docker Desktop (or colima) is a prerequisite flagged at CP3; CI runs everything regardless.
- [pino-pretty in a bundled server] → Mark logger packages as server-external; use the synchronous pretty stream, not a transport.
- [Dependency versions drift from what this plan names] → Versions are resolved and pinned at install time and recorded in the lockfile; the doc lists the resolved majors.

## Migration Plan

New project; nothing to migrate. Rollback = revert the branch merge.

## Open Questions

- Hosting target for staging/production is not chosen (does not affect E00; the image is portable).
