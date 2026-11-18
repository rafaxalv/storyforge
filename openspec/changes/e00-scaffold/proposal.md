## Epic

E00 - Scaffolding & environment (see [EPICS.md](../../../EPICS.md#e00--scaffolding--environment))

## Why

The repository holds only planning documents. Every later epic (auth, the book model, the editor, the Claude features) needs a runnable, testable and observable application to build on, with the conventions from ARCHITECTURE.md (module layout, logging, test harness, Claude seam) fixed once instead of invented per epic.

## What Changes

- Next.js 15 (App Router) + React 19 application in TypeScript strict mode, with ESLint and Prettier, and the `src/` layout from ARCHITECTURE.md §3.
- Local environment: `docker compose` with PostgreSQL 16 and MinIO; `.env.example`; `npm run dev` (web) and `npm run worker` (pg-boss worker).
- Database access with Drizzle ORM and a first, empty migration; migration command.
- Logging baseline: `log(name)` named loggers (pino), `LOG_LEVEL` switch, stdout and `logs/app.log` locally, request-id correlation via AsyncLocalStorage, one `request` line per HTTP request, startup banners for web and worker.
- `GET /api/health` reporting app version and database reachability.
- Test harness: Vitest (unit + integration against Postgres) and Playwright (e2e against a production build); one example of each.
- Claude seam: a client interface with a real implementation (Anthropic SDK) and `FakeClaude` replaying fixtures; tests use the fake by default.
- Shared framework constants: the cowriter style framework (tags and 31 dimensions in groups A–G) as typed data.
- GitHub Actions CI (lint, typecheck, unit + integration, e2e) and a Dockerfile building one image with `web` and `worker` roles.
- `doc/README.md` quick-start.

## User Stories

- **US-1** As a developer, I want a one-command local setup (`docker compose up -d && npm install && npm run dev`), so that any session can start the app immediately.
  - Acceptance: fresh clone → setup → run serves the app on localhost; steps in `doc/README.md`.
  - Acceptance: `npm run worker` starts the pg-boss worker and logs that it is ready.
- **US-2** As an AI agent or on-call human, I want a logging baseline, so that any feature can be debugged from its logs.
  - Acceptance: `log(name)` returns a pino child logger named `storyforge:<module>`; `LOG_LEVEL` switches level; stdout and `logs/app.log` locally; startup banner with version, env, level.
  - Acceptance: every HTTP request logs one `request` line with `requestId`, route, status, duration; an incoming `x-request-id` is reused and returned.
- **US-3** As an operator, I want `GET /api/health`, so that I can see the app version and whether the database is reachable.
  - Acceptance: 200 `{version, db:"ok"}` with Postgres up; 503 `{db:"error"}` with it down.
- **US-4** As a developer, I want a test harness and CI, so that every epic ships with green tests.
  - Acceptance: `npm test` runs unit + integration (Postgres) examples; `npm run test:e2e` runs a Playwright example; GitHub Actions runs lint, typecheck, tests, e2e on push.
- **US-5** As a developer, I want the Claude seam and the framework constants in place, so that features never call the SDK directly and share one definition of the style framework.
  - Acceptance: `src/server/ai/client.ts` exposes a client interface with a real implementation and `FakeClaude` replaying fixtures; tests use the fake by default.
  - Acceptance: `src/shared/framework.ts` defines the tags and the 31 dimensions (groups A–G, poles, language-sensitive and scene-level sets) with a unit test.

## Capabilities

### New Capabilities
- `service-health`: the health endpoint, request correlation ids, the per-request log line and the startup announcements of the web and worker processes — the observable operational behaviour every later epic relies on.

### Modified Capabilities
_None — no specs exist yet._

## Impact

- New code: `package.json` and lockfile, `next.config.ts`, `tsconfig.json`, lint/format config, `src/app/` (placeholder page, `api/health`), `src/server/{log.ts,db/,jobs/,ai/}`, `src/shared/framework.ts`, `src/worker.ts`, `middleware.ts`, `tests/{unit,integration,e2e,fixtures/claude}/`.
- New infrastructure files: `docker-compose.yml`, `Dockerfile`, `.dockerignore`, `.env.example`, `.github/workflows/ci.yml`, `drizzle.config.ts`.
- Dependencies (pinned in the lockfile): next, react, react-dom, drizzle-orm, drizzle-kit, pg, pg-boss, pino, pino-pretty, zod, @anthropic-ai/sdk, vitest, @playwright/test, eslint, prettier, typescript.
- Local prerequisite: Docker (not yet installed on the author's machine) for Postgres/MinIO and integration tests.
- No product behaviour for authors yet; no data model beyond the empty migration.
