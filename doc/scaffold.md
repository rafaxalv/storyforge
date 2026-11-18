---
feature: scaffold
epic: E00
change: e00-scaffold
status: draft            # draft while the epic is in flight, final at close
updated: 2026-11-18
# --- findability: keep these lists exact; agents grep them ---
files: [package.json, next.config.ts, tsconfig.json, drizzle.config.ts, docker-compose.yml, Dockerfile, .dockerignore, .env.example, .github/workflows/ci.yml, src/server/main.ts, src/server/env.ts, src/server/log.ts, src/server/db/client.ts, src/server/ai/client.ts, src/shared/framework.ts, src/worker.ts, src/app/api/health/route.ts, tests/]
entrypoints: ["GET /api/health", "npm run dev", "npm run start", "npm run worker", "npm run db:migrate", "npm test", "npm run test:e2e"]
loggers: []              # filled at doc phase from the code
events: []               # filled at doc phase from the code
env: []                  # filled at doc phase from the code
specs: [service-health]
depends_on: []
keywords: [setup, bootstrap, health check, logging, request id, correlation id, pino, ci, docker, fake claude, framework, dimensions]
---

# Scaffolding & environment

## What it does

The runnable baseline every other epic builds on: the Next.js web process behind a small custom server, the pg-boss worker, Postgres via Drizzle, the logging baseline with per-request correlation ids, the health endpoint, the test harness and CI, the Docker image, the Claude client seam with FakeClaude, and the shared constants of cowriter's 31-dimension style framework. Stories: E00/US-1 to US-5.

## How it works

_To be written at the doc phase._

## Files

_To be written at the doc phase._

## Configuration

_To be written at the doc phase._

## Logs & debugging

_To be written at the doc phase._

## How to run & test

_To be written at the doc phase._

## Known gaps / follow-ups

_To be written at the doc phase._

## References

- Behavior contract: `openspec/specs/service-health/spec.md` (after archive)
- Change: `openspec/changes/e00-scaffold/`
- PRD: PRD.md §11 Environments & deployment, §12 Observability expectations, §13 Testing strategy; ARCHITECTURE.md §2, §3, §8–§10
