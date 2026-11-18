# storyforge — documentation index

This folder is the project's memory. One file per feature (epic); keep them current — a future session (human or AI) starts here.

Planning: [PRD.md](../PRD.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) · [EPICS.md](../EPICS.md) · specs in `../openspec/specs/`

## Quick start

- Setup: `<cmd>`
- Run: `<cmd>`
- Tests: `<cmd>`
- Logs: `<where>`; debug switch: `<env var>`

## Features

| Doc | Epic | Status | Entrypoints | Files | One-liner |
|-----|------|--------|-------------|-------|-----------|
| [scaffold.md](scaffold.md) | E00 | draft | `GET /api/health`, `npm run dev`, `npm run worker` | `src/server/`, `src/shared/framework.ts`, `src/worker.ts` | Toolchain, logging + request ids, health, worker, tests/CI, image, Claude seam |

Finding the right doc: `grep -l "<file, route, logger, event or env var>" doc/*.md` — every doc's header lists its `files`, `entrypoints`, `loggers`, `events`, `env`, `specs`, `keywords`. Behavior lives in `../openspec/specs/`, not here.

## Conventions

- Logging: pino via `log(name)` → `storyforge:<module>`; `requestId` on every line; never log book text — see ARCHITECTURE.md §8
- Branches: `epic/<change-name>`; commits `<type>(<change-name>): ...`
- Every epic ends with: tests green, feature doc final, `openspec archive`, merge to main.
