# storyforge — documentation index

This folder is the project's memory. One file per feature (epic); keep them current — a future session (human or AI) starts here.

Planning: [PRD.md](../PRD.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) · [EPICS.md](../EPICS.md) · specs in `../openspec/specs/`

## Quick start

**Prerequisites:** Node 22 (`.nvmrc`; with Homebrew's `node@22` add `/opt/homebrew/opt/node@22/bin` to `PATH`) and Docker (Docker Desktop, or colima + the `docker` / `docker-compose` CLIs). Commands below say `docker compose`; with Homebrew's standalone Compose use `docker-compose`.

| Step | Command |
|------|---------|
| Configure | `cp .env.example .env` (local-only placeholder credentials) |
| Start Postgres | `docker compose up -d` (creates `storyforge` and `storyforge_test`, port 127.0.0.1:5432) |
| Install | `npm ci` |
| Migrate | `npm run db:migrate` |
| Run web (dev) | `npm run dev` → http://localhost:3000, health at `/api/health` |
| Run worker (dev) | `npm run worker` |
| Lint / types | `npm run lint && npm run typecheck` |
| Tests | `npm run test:unit` (no Docker needed) · `npm test` (unit + integration, needs Postgres) |
| E2E | `npx playwright install chromium` once, then `npm run build && npm run test:e2e` |
| Production build | `npm run build` → `npm run start` (web) / `npm run worker:start` (worker); `.env*` files load as in Next.js, variables already set in the process win |
| Image | `docker build -t storyforge .` → `docker run -e ROLE=web\|worker -e DATABASE_URL=… storyforge`; migrations: `docker run … storyforge node dist/migrate.js` |

**Logs:** stdout (coloured in dev, JSON in production) and `logs/app.log` when `LOG_FILE` is set (it is in `.env.example`). Level: `LOG_LEVEL` (`trace` … `silent`; `.env.example` uses `debug`). Follow one request with `grep '"requestId":"<id>"' logs/app.log`; the id is in the `x-request-id` response header. Details: [scaffold.md](scaffold.md#logs--debugging).

**Claude:** `AI_CLIENT=fake` (default) replays `tests/fixtures/claude/`; `AI_CLIENT=anthropic` needs `ANTHROPIC_API_KEY` and costs money.

## Features

| Doc | Epic | Status | Entrypoints | Files | One-liner |
|-----|------|--------|-------------|-------|-----------|
| [scaffold.md](scaffold.md) | E00 | final | `GET /api/health`, `npm run dev`, `npm run worker` | `src/server/`, `src/shared/framework.ts`, `src/worker.ts` | Toolchain, logging + request ids, health, worker, tests/CI, image, Claude seam |

Finding the right doc: `grep -l "<file, route, logger, event or env var>" doc/*.md` — every doc's header lists its `files`, `entrypoints`, `loggers`, `events`, `env`, `specs`, `keywords`. Behavior lives in `../openspec/specs/`, not here.

## Conventions

- Logging: pino via `log(name)` → `storyforge:<module>`; `requestId` on every line; never log book text — see ARCHITECTURE.md §8
- Branches: `epic/<change-name>`; commits `<type>(<change-name>): ...`
- Every epic ends with: tests green, feature doc final, `openspec archive`, merge to main.
