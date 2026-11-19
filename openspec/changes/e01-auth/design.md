## Context

E00 left a runnable app: a custom Node server around Next.js 15, `startProcess(role)` bootstrap, Zod-validated env (`getEnv()`), pino with per-request ids, a pg-boss worker with no queues, Drizzle with an empty baseline migration, `processSingleton()` for state shared between the esbuild server bundle and Next's route bundles. No tables, no users. ARCHITECTURE.md now names Better Auth (decided 2026-11-19 because Auth.js v5 is still beta). The known E00 follow-up — the DB client reading `process.env.DATABASE_URL` instead of the validated env — lands here, since auth is the first real data.

## Goals / Non-Goals

**Goals:**
- Email magic link and Google sign-in on Better Auth with sessions in Postgres.
- One access layer (`getActor`, `requireOwner`, `requireAdmin`) that every later domain module uses, plus a copyable integration-test pattern.
- Account deletion with a purge job that later epics extend by registering steps.
- Every auth path testable without real email or Google: outbox transport and Better Auth's test-utils plugin.

**Non-Goals:**
- Passwords, passkeys, 2FA, organisations or co-authors (PRD A2).
- Choosing a production email provider (SMTP is the interface; the provider is a hosting decision).
- Usage caps UI (E08, E14); admin pages (E09/E14).

## Decisions

1. **Better Auth 1.7.26, exact pin**, configured once in `src/server/auth/auth.ts` as a process singleton (`processSingleton("auth", …)`) so the custom server, route handlers and server actions share one instance. Plugins: `magicLink` (expires 15 min, single use) and `nextCookies` (so server actions can set cookies). Google via `socialProviders.google` only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set. Account linking trusts Google (verified emails), so one email = one account.
   - Alternative: Auth.js v5 beta — rejected (beta, maintenance moved to Better Auth). Rolling our own — rejected (security-sensitive, no gain).
2. **Mounting:** `src/app/api/auth/[...all]/route.ts` exports `toNextJsHandler(auth)`. Requests still go through the E00 request boundary, so auth calls get request ids and one `request` line like everything else.
3. **Schema:** Drizzle tables `user`, `session`, `account`, `verification`, `rate_limit` in `src/server/db/schema/auth.ts`, generated with the Better Auth CLI against our config and then reviewed by hand; `user` gets `role` (`'user' | 'admin'`, default `user`) and `monthly_token_cap` (nullable int) as Better Auth `additionalFields` (`input: false` so clients can't set them). Snake_case column names, text ids as Better Auth generates them. One migration `0001_auth`.
4. **Sessions:** `expiresIn` 30 days, `updateAge` 1 day (sliding), `freshAge` 1 day (required for account deletion). Cookies HTTP-only, `SameSite=Lax`, `Secure` when `BETTER_AUTH_URL` is https. Better Auth's origin check with `trustedOrigins = [BETTER_AUTH_URL]` covers CSRF for its endpoints; our own server actions are protected by Next's server-action origin check.
5. **Page protection, two layers:**
   - `src/middleware.ts` (edge): if there is no session cookie (`getSessionCookie` from `better-auth/cookies`), redirect app pages to `/sign-in?next=<path>`. Optimistic only — a cookie isn't proof.
   - `src/app/(app)/layout.tsx` (server): `getActor()` validates the session against the database; invalid → redirect. All app pages live under the `(app)` route group; sign-in pages under `(auth)`. The `next` parameter is accepted only if it starts with a single `/` (not `//`), else `/`.
6. **Access layer** (`src/server/auth/actor.ts`):
   - `type Actor = { userId: string; email: string; name: string; role: "user" | "admin" }`.
   - `getActor()` reads the session via `auth.api.getSession({ headers })` (request headers from `next/headers`, or explicit headers in jobs/tests) and throws `Unauthenticated` when absent. `getOptionalActor()` returns `null` instead.
   - `requireOwner(actor, ownerId)` throws `Forbidden` unless equal; `requireAdmin(actor)` throws `Forbidden` unless admin.
   - Route handlers and server actions map `Unauthenticated` → 401 / redirect and `Forbidden` → 404 (no existence leak) via one `withActor()` wrapper; tests assert the mapping.
   - Every domain function from now on takes `actor` as its first argument (ARCHITECTURE §3); E01's only one is `updateDisplayName(actor, userId, name)`, which doubles as the example for the cross-user test pattern (`tests/integration/access.test.ts` + a `twoUsers()` fixture).
7. **Admin role:** `ADMIN_EMAILS` (comma-separated, lower-cased, validated as emails) in env. A Better Auth `databaseHooks.session.create.after` sets `user.role` to `admin` or `user` to match the list on every sign-in, so removing someone from the list takes effect at their next sign-in.
8. **Email transport** (`src/server/auth/mail.ts`): `EMAIL_TRANSPORT = console | outbox | smtp`.
   - `console` (dev default): prints the link to stdout with a clear banner, *not* through the logger (links are credentials and must never reach log files).
   - `outbox`: writes one JSON file per message to `MAIL_OUTBOX_DIR` (tests, e2e, local inspection).
   - `smtp`: nodemailer with `SMTP_URL` and `MAIL_FROM`.
   - Env validation: `production` requires `smtp`; `console`/`outbox` are refused in production.
9. **Rate limits:** Better Auth `rateLimit` with `storage: "database"` (works across web processes), enabled in every environment; custom rules: `/sign-in/magic-link` 5 per 10 min, `/delete-user` 3 per 10 min; default 100 per minute for other auth endpoints. Client key from the socket address in the custom server (we do not trust `X-Forwarded-For` until a proxy is configured; documented).
10. **Account deletion:** Better Auth `user.deleteUser.enabled` with `afterDelete(user)` enqueuing `account.purge` `{ userId }` (pg-boss, retry 5, backoff). UI: settings page dialog with typed `DELETE`; the server action checks the confirmation text again, calls `auth.api.deleteUser`, clears cookies and redirects to `/goodbye`. Better Auth deletes `user`, `session`, `account` rows itself.
11. **Purge registry** (`src/server/jobs/purge.ts`): `registerPurgeStep(name, fn(userId))`; the `account.purge` handler runs all steps in registration order and logs per step. E01 registers one step: remove any leftover `verification` rows for the email hash (magic links). Later epics register their own tables/files.
12. **Job queue for the web role** (`src/server/jobs/queue.ts`): a send-only pg-boss instance as a process singleton, started lazily on first send; the worker keeps its own instance that also works jobs. Queue names are constants in `src/server/jobs/names.ts`.
13. **Validated DB URL:** `getPool()` uses `getEnv().DATABASE_URL`; tests that switch databases call `closeDb()` and set the env through a small `withDatabaseUrl()` test helper that also resets the env cache (`resetEnvForTests()`), closing the E00 follow-up.
14. **UI:** minimal, server-rendered forms with progressive enhancement; no design system yet. Pages: `/sign-in`, `/sign-in/check-email`, `/sign-in/error`, `/` (signed-in landing: "Hello, <name> — books arrive in E02"), `/settings`, `/goodbye`. Client JS only for the delete dialog.
15. **Testing:**
   - Unit: mail transports, `next` sanitiser, env rules, role sync, `withActor` mapping.
   - Integration: real Better Auth against `storyforge_test` using the `outbox` transport (request link → read file → open link via `auth.handler`), Better Auth's `testUtils` plugin in a test-only auth instance for creating signed-in users fast; access pattern tests; rate-limit test; deletion + purge job run in-process.
   - E2E (Playwright): sign-in through the outbox folder, settings rename, sign-out, delete account, redirect when signed out.
   - Google: unit-tested config (button shown/hidden); a real Google sign-in is a `manual` row needing credentials.
16. *Changed during code (2026-11-19):*
   - **Tests sign in for real** through the HTTP handler and the outbox (`tests/integration/auth-helpers.ts`: `signIn`, `twoUsers`); Better Auth's `testUtils` plugin is not used.
   - **E2E sends email over real SMTP** to a local sink (`smtp-server` + `mailparser`, dev-only) started in Playwright's global setup, because production rightly refuses the `outbox` transport. This also covers the SMTP transport end to end.
   - **Display name default:** magic-link sign-ups have no name; a `user.create.before` hook sets the email's local part (`defaultName`). The `auth.sign_in` event has no `newUser` field; new accounts log `auth.user.created`.
   - **Purge:** unused sign-in links are deleted in `afterDelete` (they are keyed by email), so the `account.purge` job payload carries only the user id. E01 registers no purge steps; later epics add theirs.
   - **No `/delete-user` rate rule:** deletion goes through our server action (typed confirmation + fresh session), which calls `auth.api` directly and is not rate limited by Better Auth's HTTP layer.
   - **`auth.rate_limited`:** Better Auth answers 429 without logging; `handleAuthRequest()` wraps its handler and logs it.
   - **Client address:** the request boundary sets `x-storyforge-client-ip` from the socket on every request; Better Auth reads only that header, so spoofed `X-Forwarded-For` doesn't escape the limit.
   - **Two fixes in the E00 runtime found here:** dev servers build into `.next-dev` (`next.config.mjs` `distDir`) so they can't overwrite the production build in `.next`; and `next()` now gets this server's `hostname`/`port` — Next fetches server-action redirect targets from itself and defaulted to `localhost:3000`.
   - **Error reason:** Better Auth reports used and expired links alike as `INVALID_TOKEN`; `auth.link.invalid` logs reason `invalid` (or `expired` if it ever says so).

## Observability

- **Loggers:** `storyforge:auth` (sign-in, session, role), `storyforge:mail`, `storyforge:account`, `storyforge:jobs`, `storyforge:access` (refusals).
- **Events:**
  - `auth.magic_link.requested` (info): `{ emailHash, transport }` — never the email or the link.
  - `auth.sign_in` (info): `{ userId, method: "magic-link" | "google", newUser }`.
  - `auth.sign_out` (info): `{ userId }`.
  - `auth.link.invalid` (warn): `{ reason: "expired" | "used" | "unknown" }`.
  - `auth.rate_limited` (warn): `{ path, retryAfterS }`.
  - `auth.role.synced` (info, only when it changes): `{ userId, role }`.
  - `access.denied` (warn): `{ userId, reason: "unauthenticated" | "not-owner" | "not-admin", op }`.
  - `mail.sent` (info): `{ transport, template }`; `mail.failed` (error): `{ transport, template, err }`.
  - `account.name.updated` (info): `{ userId }`.
  - `account.delete.requested` / `account.deleted` (info): `{ userId }`; `account.delete.refused` (warn): `{ userId, reason: "confirmation" | "stale-session" }`.
  - `jobs.enqueued` (info): `{ queue, jobId }`; `account.purge.step` (info/error): `{ userId, step, ok }`; `account.purge.done` (info): `{ userId, steps }`.
- **Better Auth's own logger** is routed into pino at `storyforge:auth` (its `logger.log(level, message)` hook), level mapped, so its warnings carry request ids.
- **Correlation:** request ids as in E00; the purge job carries `jobId` and the originating `requestId` in its data and log context.
- **Hashing:** `emailHash` = first 12 hex of SHA-256 of the lower-cased email with `BETTER_AUTH_SECRET` as HMAC key — stable for correlating, useless for recovering the address.
- **Redaction:** add `*.token`, `*.url` inside auth payloads, cookies already redacted; tests grep logs for the email address, the link token and `BETTER_AUTH_SECRET`.
- **Switch:** `LOG_LEVEL=debug` adds Better Auth's debug output.

## Security

Rule files in `.claude/rules/security/` that apply:

- **owasp-2025.md**
  - A01 Broken Access Control: server-side `getActor` on every protected page/action/route; `requireOwner` / `requireAdmin`; 404 (not 403) for other users' data; middleware is only a convenience layer. Tests for each refusal.
  - A02 Misconfiguration: secure cookies in production, `trustedOrigins` set, `smtp` required in production, `BETTER_AUTH_SECRET` ≥ 32 chars validated, generic error pages.
  - A04 Cryptographic failures: tokens and session ids generated by Better Auth (CSPRNG); no passwords stored; email hash uses HMAC.
  - A05 Injection: Drizzle parameterised queries only; Zod validation for every form/action input (email, name, confirmation).
  - A07 Authentication failures: single-use 15-minute links, rate limits on link requests and deletion, session invalidated on sign-out and deletion, fresh session required to delete, open-redirect protection on `next`.
  - A09 Logging: auth events logged without emails, links, tokens or secrets.
  - A10 Exceptional conditions: mail failure surfaces as a retryable message and `mail.failed`, never as a silent success; purge failures retry and are logged.
- **typescript.md**: Zod for all external input (form data, env, purge job payloads); string-literal unions for `role`; no `as` on untrusted data.
- **react.md**: no `dangerouslySetInnerHTML`; `next` redirect validated server-side; no tokens in client state (Better Auth cookie is HTTP-only); server actions only (CSRF via Next's origin check).
- **ai-security.md**: not applicable — no Claude calls in E01.
- **docker.md / github-actions.md**: CI gains `BETTER_AUTH_SECRET` as a generated per-run value (no repository secret), and `EMAIL_TRANSPORT=outbox`; no workflow permission changes.

## Risks / Trade-offs

- [Better Auth schema/API differs from what the docs say for 1.7.26] → generate the schema with its CLI for our exact config, pin the version, integration-test every flow against a real Postgres.
- [Edge middleware can't validate sessions] → it only checks cookie presence; the `(app)` layout and every action validate against the DB.
- [Rate limiting by socket address is wrong behind a proxy] → documented; a `TRUST_PROXY` setting comes with the hosting decision.
- [Magic links in console output during dev] → only in `development` with `console` transport, never via the logger, refused in production.
- [Purge registry is empty-ish in E01] → the mechanism is tested with a test-only step; each later epic must register its tables (added to the ps-spec plan checklist via the doc).

## Migration Plan

New tables only (`0001_auth`). Rollback = revert the merge and drop the five tables (no other data exists yet).

## Open Questions

- Production email provider (any SMTP service) — decided with hosting; not needed for E01.
