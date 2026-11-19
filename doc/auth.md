---
feature: auth
epic: E01
change: e01-auth
status: draft
updated: 2026-11-19
# --- findability: keep these lists exact; agents grep them ---
files: [src/server/auth/auth.ts, src/server/auth/actor.ts, src/server/auth/mail.ts, src/server/db/schema/auth.ts, src/app/api/auth/[...all]/route.ts, src/middleware.ts, src/app/(auth)/, src/app/(app)/, src/server/jobs/queue.ts, src/server/jobs/purge.ts, src/server/jobs/names.ts]
entrypoints: ["/sign-in", "/sign-in/check-email", "/sign-in/error", "/settings", "/goodbye", "POST /api/auth/sign-in/magic-link", "GET /api/auth/magic-link/verify", "GET /api/auth/callback/google", "POST /api/auth/sign-out", "GET /api/auth/get-session", "job: account.purge"]
loggers: []              # filled at doc phase from the code
events: []               # filled at doc phase from the code
env: []                  # filled at doc phase from the code
specs: [auth-session, account-management]
depends_on: [scaffold]
keywords: [login, sign in, sign out, magic link, google, oauth, session, cookie, better auth, actor, ownership, admin, rate limit, delete account, purge, gdpr]
---

# Accounts & auth

## What it does

Authors sign in with an emailed magic link or Google (Better Auth, sessions in Postgres), set a display name and can delete their account, which queues a purge of everything storyforge holds for them. Every server function gets the signed-in `actor` from `getActor()` and refuses other users' data with `requireOwner` / `requireAdmin` — the access pattern every later epic follows. Stories: E01/US-1 to US-3.

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

- Behavior contract: `openspec/specs/auth-session/spec.md`, `openspec/specs/account-management/spec.md` (after archive)
- Change: `openspec/changes/e01-auth/`
- PRD: FR-1–3, NFR-4, NFR-5; ARCHITECTURE.md §2 (Auth), §6 (Security)
