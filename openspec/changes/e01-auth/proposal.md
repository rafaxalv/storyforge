## Epic

E01 - Accounts & auth (see [EPICS.md](../../../EPICS.md#e01--accounts--auth))

## Why

storyforge is a hosted, multi-user app whose books must never leak between users (PRD FR-2, NFR-4/5). Before any book data exists (E02+), every request needs to know who is asking, and every domain function needs one shared way to refuse access to other users' data. Accounts also need a way out: an author must be able to delete everything (FR-3).

## What Changes

- Sign-in with an emailed magic link or with Google, using **Better Auth** (stable 1.7 line) with its Drizzle adapter; sessions in Postgres, 30 days, sliding. Replaces Auth.js v5 in ARCHITECTURE.md (still beta).
- Email delivery behind a small transport switch: `console` (dev), `outbox` (a folder of JSON files, for tests and e2e) and `smtp` (production; required there).
- Pages: sign-in, "check your email", settings (display name, delete account); every app page except sign-in and the health endpoint requires a session.
- `getActor()` plus `Unauthenticated` / `Forbidden` errors, `requireOwner()` and `requireAdmin()` helpers in `src/server/auth/`, and an integration-test pattern later epics copy for every entity.
- Admin role from `ADMIN_EMAILS`, synced on every sign-in.
- Account deletion: typed confirmation, recent session required, signs out, and a `account.purge` worker job that runs registered purge steps (none own data yet; later epics add theirs).
- Rate limits on sign-in and account endpoints, stored in Postgres so they hold across processes.
- New tables: `user` (with `role`, `monthly_token_cap`), `session`, `account`, `verification`, `rate_limit`.

## User Stories

- **US-1** As an author, I want to sign in with an email magic link or Google, so that my books are mine.
  - Acceptance: magic link (console transport locally) and Google OAuth sign in; session lasts 30 days; sign-out works; app pages redirect signed-out users.
- **US-2** As an author, I want to set my display name and delete my account, so that I control my data.
  - Acceptance: display name editable in settings.
  - Acceptance: deletion asks for confirmation, signs out, and a purge job removes every row and stored file of the user.
- **US-3** As a developer, I want `getActor()`, ownership and admin helpers, so that every domain function enforces access the same way.
  - Acceptance: no actor → `Unauthenticated`; another user's row → `Forbidden`; `ADMIN_EMAILS` grants `role=admin`; an integration-test pattern later epics copy.

## Capabilities

### New Capabilities
- `auth-session`: signing in (magic link, Google), session lifetime and sign-out, page protection, sign-in rate limits, the actor/ownership/admin rules every server function applies.
- `account-management`: the author's own account — display name, deleting the account, and purging their data.

### Modified Capabilities
_None._ (`service-health` is unchanged; `/api/health` stays public.)

## Impact

- New code: `src/server/auth/` (Better Auth config, actor and access helpers, mail transports), `src/app/api/auth/[...all]/route.ts`, `src/middleware.ts` (optimistic redirect), `src/app/(auth)/sign-in`, `src/app/(app)/` layout + settings, `src/server/jobs/` (queue client, `account.purge` handler, purge-step registry), Drizzle schema + migration for the auth tables.
- Changed: `src/worker.ts` registers the purge job; `src/server/env.ts` gains auth and email variables; home page becomes the signed-in landing page.
- Dependencies: `better-auth` (exact pin), `nodemailer` for SMTP.
- New secrets: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `SMTP_URL` (never logged).
- Docs: ARCHITECTURE.md and the OpenSpec context already switched to Better Auth (2026-11-19).
