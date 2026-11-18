## 1. Project setup

- [ ] 1.1 Initialise the Next.js 15 + React 19 TypeScript app in the repo root (App Router, `src/` dir, no example content), Node 22 in `engines` and `.nvmrc`; verify `npm run build` succeeds
- [ ] 1.2 Configure `tsconfig.json` strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`), ESLint (Next + TypeScript, `no-explicit-any` in `src/`) and Prettier; add `lint`, `typecheck`, `format` scripts; verify `npm run lint && npm run typecheck` pass
- [ ] 1.3 Create the `src/` layout from ARCHITECTURE.md §3 (`app/`, `components/`, `server/`, `shared/`) with a placeholder home page; `next.config.ts` with `output: "standalone"`, `poweredByHeader: false`, `serverExternalPackages`; verify the page renders in `npm run dev`
- [ ] 1.4 Add `.env.example` (placeholders only), `.gitignore` entries (`.env*` except example, `logs/`, `dist/`, test outputs) and `src/server/env.ts` Zod validation; verify an invalid `DATABASE_URL` exits with `env.invalid` naming the variable, not its value

## 2. Local infrastructure and database

- [ ] 2.1 Add `docker-compose.yml` with Postgres 16 and MinIO (digest-pinned, ports on 127.0.0.1, healthchecks, named volumes) and an init script creating `storyforge_test`; verify `docker compose up -d` reports both healthy
- [ ] 2.2 Add Drizzle (`drizzle.config.ts`, `src/server/db/client.ts`, empty schema, first empty migration) and `db:generate` / `db:migrate` scripts; verify `npm run db:migrate` runs against compose Postgres

## 3. Web server, health and worker

- [ ] 3.1 Implement the custom server `src/server/main.ts` (http + Next handler) and wire `dev`/`start` scripts to it; verify the placeholder page is served by `npm run dev` and `npm run start`
- [ ] 3.2 Implement `GET /api/health` (`SELECT 1` with 2 s timeout → 200 `{version, db:"ok"}` / 503 `{version, db:"error"}`, generic body on failure); verify with curl with Postgres up and stopped
- [ ] 3.3 Implement `src/worker.ts` with pg-boss start, graceful stop on SIGTERM/SIGINT, exit 1 when the database is unreachable; `worker` script with tsx; verify start/ready/stop in a manual run
- [ ] 3.4 Add the generic production error handling in the custom server (unhandled error → 500 `{"error":"Internal server error"}`, details only in logs); verify with a test-only failing route in the integration suite

## 4. Shared modules

- [ ] 4.1 Add `src/shared/framework.ts` (5 tags, 31 dimensions with groups A–G and poles from cowriter's voice-generator, `LANGUAGE_SENSITIVE`, `SCENE_LEVEL`); verify its unit test
- [ ] 4.2 Add the Claude seam `src/server/ai/client.ts` (`ClaudeClient`, `AnthropicClaude`, `FakeClaude` with Zod-validated fixtures and `MissingFixtureError`, `getClaude()` by `AI_CLIENT`, default model `claude-opus-5-5`), using SDK types per the claude-api skill's TypeScript reference; verify unit tests replay a fixture and fail on a missing one without network access

## 5. Packaging and CI

- [ ] 5.1 Add the multi-stage `Dockerfile` (digest-pinned `node:22-alpine`, non-root, standalone web + esbuild-bundled worker, `ROLE` switch, `HEALTHCHECK`) and `.dockerignore`; verify `docker build` succeeds and `docker run` with `ROLE=web` answers `/api/health`
- [ ] 5.2 Add `.github/workflows/ci.yml` (push + pull_request, `permissions: contents: read`, SHA-pinned actions, Postgres service, npm ci, lint, typecheck, unit + integration, Playwright e2e, docker build); verify the workflow passes on the pushed epic branch (or with `act` if not pushed)

## 6. Observability

- [ ] 6.1 Implement `src/server/log.ts` (`log(name)`, root pino, multistream stdout + `LOG_FILE`, pretty in dev, JSON in production, `LOG_LEVEL`, redaction paths) and the request context (AsyncLocalStorage store with `requestId` and `jobId` slots, logger mixin); verify lines carry `module` and `requestId` in a manual run
- [ ] 6.2 Add request-id handling and the `request` line in the custom server (validate/reuse `x-request-id`, generate otherwise, set response header and incoming header, one line on finish/close with `requestId, method, route, status, durationMs`); verify with curl and `logs/app.log`
- [ ] 6.3 Add `startup` lines for both roles, `request.error`, `health.db.failed`, `worker.*` and `ai.*` events as listed in design.md; verify each appears in a manual run (stop Postgres for the failure lines)

## 7. Tests

- [ ] 7.1 Set up Vitest projects (`unit`, `integration` with migrations on `storyforge_test` in global setup) and scripts `test`, `test:unit`, `test:integration`; verify `npm run test:unit` runs without Docker
- [ ] 7.2 Integration tests for every `service-health` scenario: health ok, health with unreachable DB (bad URL) → 503 without error details, request id reused / replaced (valid, too long, bad characters), one `request` line with the required fields and no cookie/authorization/body, `LOG_LEVEL=warn` suppresses `request` lines; verify green
- [ ] 7.3 Integration tests for the worker scenarios (ready with DB, exit non-zero without DB) by spawning the worker process; verify green
- [ ] 7.4 Security checks: env validation fails closed without leaking values; 500 response body is generic; redaction removes cookie and authorization; ESLint forbids `any`; a script check that compose ports bind to 127.0.0.1, Dockerfile runs as non-root and uses digest-pinned images, and CI actions are SHA-pinned with `contents: read`; verify all green
- [ ] 7.5 Playwright e2e: home page loads and the response has an `x-request-id` header; `/api/health` returns 200 against the built app; verify `npm run test:e2e` green
- [ ] 7.6 Run the full suite and every row of test-plan.md; record results in test-plan.md; verify all rows `pass`

## 8. Docs

- [ ] 8.1 Fill `doc/README.md` quick-start (prerequisites incl. Docker and the Node PATH line, setup, run web and worker, tests, logs, env vars) and verify a fresh clone follows it end to end
- [ ] 8.2 Finalize `doc/scaffold.md` (findability header with files, entrypoints, loggers, events, env, specs; logs & debugging; deployment hardening notes) and its row in `doc/README.md`; set `status: final`
- [ ] 8.3 Refresh `openspec/config.yaml` `context:` with the resolved commands and any convention changes made during the epic
