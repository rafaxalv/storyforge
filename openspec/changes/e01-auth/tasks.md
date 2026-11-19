## 1. Setup and configuration

- [x] 1.1 Add `better-auth@1.7.26` and `nodemailer` (exact pins, `npm audit --omit=dev` clean); verify install and audit
- [x] 1.2 Extend `src/server/env.ts` with `BETTER_AUTH_SECRET` (≥ 32 chars), `BETTER_AUTH_URL`, `ADMIN_EMAILS`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (both or neither), `EMAIL_TRANSPORT` (`console|outbox|smtp`, production requires `smtp`), `MAIL_OUTBOX_DIR`, `SMTP_URL`, `MAIL_FROM`; update `.env.example` (generated dev secret placeholder) and CI env; verify env unit tests for each rule
- [x] 1.3 Make `getPool()` use `getEnv().DATABASE_URL` and add `resetEnvForTests()` + `withDatabaseUrl()` test helper (E00 follow-up); verify existing suites stay green

## 2. Database

- [x] 2.1 Generate the Better Auth schema with its CLI for our config, write `src/server/db/schema/auth.ts` (user with `role`, `monthly_token_cap`; session; account; verification; rate_limit; snake_case columns), review against the CLI output; verify `npm run db:generate` produces `0001_auth` and `npm run db:migrate` applies it

## 3. Auth core

- [x] 3.1 Implement `src/server/auth/mail.ts` (console / outbox / smtp transports, magic-link template in plain text + HTML-escaped HTML) ; verify unit tests per transport
- [x] 3.2 Implement `src/server/auth/auth.ts` (Better Auth singleton: Drizzle adapter, magicLink 15 min, nextCookies, optional Google, account linking, sessions 30 d / update 1 d / fresh 1 d, trustedOrigins, rate limit rules in DB, additional fields, deleteUser with afterDelete, role-sync hook, logger routed to pino); verify integration test: request link → outbox → open link → session
- [x] 3.3 Mount `src/app/api/auth/[...all]/route.ts` with `toNextJsHandler`; verify `GET /api/auth/get-session` returns null signed out and the user signed in (http)
- [x] 3.4 Implement `src/server/auth/actor.ts` (`Actor`, `getActor`, `getOptionalActor`, `Unauthenticated`, `Forbidden`, `requireOwner`, `requireAdmin`, `withActor` mapping to 401/404/redirect) and the `safeNext()` redirect sanitiser; verify unit tests

## 4. Pages and middleware

- [x] 4.1 Add `src/middleware.ts` (cookie-presence redirect for app pages, `/api/health`, `/api/auth/*` and `/sign-in*` public) and move the home page under `src/app/(app)/` with a layout that validates the session via `getActor()`; verify signed-out redirect with `next`
- [x] 4.2 Sign-in pages under `src/app/(auth)/`: `/sign-in` (email form, Google button when configured, error messages), `/sign-in/check-email`, `/sign-in/error`; verify in the browser
- [x] 4.3 Signed-in landing page and header (display name, sign-out); verify sign-out clears the session

## 5. Account management

- [x] 5.1 `updateDisplayName(actor, userId, name)` domain function + settings form server action (Zod 1–80 chars, trimmed); verify integration tests incl. another user's id → Forbidden
- [x] 5.2 Delete-account dialog (typed `DELETE`) + server action (re-checks confirmation, requires fresh session, calls Better Auth deleteUser, signs out, redirects to `/goodbye`); verify integration + e2e
- [x] 5.3 Job queue client `src/server/jobs/queue.ts`, queue names, purge registry `src/server/jobs/purge.ts`, `account.purge` handler registered in `src/worker.ts`, E01 purge step (leftover verification rows); verify integration test runs the job in-process and the worker picks it up in a manual run

## 6. Observability

- [x] 6.1 Add the loggers and events from design.md (auth, mail, account, jobs, access), the HMAC `emailHash`, Better Auth logger bridge and extra redaction paths; verify each event in a manual run and that no email, link, token or secret appears in `logs/app.log`

## 7. Tests

- [x] 7.1 Unit tests: env rules, mail transports, `safeNext`, `withActor` mapping, role sync decision, `emailHash`; verify `npm run test:unit`
- [x] 7.2 Integration tests for every `auth-session` scenario (magic link first/returning/used/expired/invalid, session + sign-out, page protection, rate limit 429 without email, access refusals 401/404, admin role sync both ways) with a `twoUsers()` fixture and test-only auth instance using `testUtils`; verify green
- [x] 7.3 Integration tests for every `account-management` scenario (name valid/invalid, deletion confirmed / missing confirmation / stale session, purge job runs steps, failing step retries and logs); verify green
- [x] 7.4 Security checks: cookies HttpOnly/SameSite (and Secure with an https base URL), `next` open-redirect cases, production refuses console/outbox transport, no email/link/token/secret in logs, rate-limit storage in DB; verify green
- [x] 7.5 Playwright e2e: sign in through the outbox folder, rename, sign out, redirect when signed out, delete account; verify `npm run test:e2e`
- [ ] 7.6 Run the full suite and every row of test-plan.md; record results; verify all rows `pass` (Google row may be done by the author with real credentials)

## 8. Docs

- [ ] 8.1 Write `doc/auth.md` (findability header, flows, access-layer pattern for later epics, purge registry, env, logs & debugging) and update its row in `doc/README.md`; set `status: final`
- [ ] 8.2 Update `doc/README.md` quick-start (dev sign-in via console link, outbox), `doc/scaffold.md` (DB URL follow-up closed), `.env.example`, and `openspec/config.yaml` context (auth conventions: `getActor` first, 404 for foreign data, purge steps)
