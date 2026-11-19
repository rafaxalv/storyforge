## Automated tests

Prerequisites: Postgres up (`docker compose up -d` / `docker-compose up -d`), `npm run db:migrate`, `.env` with `EMAIL_TRANSPORT=outbox` for integration/e2e (the suites set it themselves). E2E needs `npm run build` and Playwright's Chromium.

- Command: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`
- `tests/unit/env-auth.test.ts` → secret length, Google both-or-neither, `ADMIN_EMAILS` parsing, production refuses `console`/`outbox` transports
- `tests/unit/mail.test.ts` → console / outbox / smtp transports (smtp with a stub transport); link never passed to the logger
- `tests/unit/safe-next.test.ts` → auth-session / "Foreign redirect target" (`//evil`, `https://evil`, `/\evil`, encoded variants → `/`; `/settings` kept)
- `tests/unit/actor.test.ts` → `withActor` maps Unauthenticated → 401/redirect, Forbidden → 404; `requireOwner`, `requireAdmin`
- `tests/unit/role-sync.test.ts` → role decision from `ADMIN_EMAILS` (case-insensitive)
- `tests/integration/magic-link.test.ts` → auth-session / "First sign-in creates the account", "Returning author signs in", "Used or expired link", "Invalid address"
- `tests/integration/session.test.ts` → auth-session / "Session persists" (expiry 30 d, sliding), "Sign-out"; cookie flags
- `tests/integration/rate-limit.test.ts` → auth-session / "Too many link requests" (6th → 429, no outbox file)
- `tests/integration/access.test.ts` → auth-session / "No session", "Another user's data", "Admin-only operation by a non-admin" (the copyable `twoUsers()` pattern)
- `tests/integration/admin-role.test.ts` → auth-session / "Listed author signs in", "Author removed from the list"
- `tests/integration/google-config.test.ts` → auth-session / "Google configured" (provider registered, linking to the email account via Better Auth's account-linking path with a stubbed OAuth profile), "Google not configured"
- `tests/integration/account.test.ts` → account-management / "Valid name", "Invalid name", "Confirmed deletion", "Missing confirmation", "Old session"
- `tests/integration/purge.test.ts` → account-management / "Purge runs", "Purge step fails" (test-only failing step, retried, logged without data)
- `tests/integration/log-hygiene.test.ts` → no email address, link token or `BETTER_AUTH_SECRET` in captured log lines across a full sign-in → rename → delete flow
- `tests/e2e/auth.spec.ts` → sign in via outbox, landing shows name, rename in settings, sign out, signed-out redirect with `next`, delete account → `/goodbye`
- Existing E00 suites stay green (`service-health` unchanged: `/api/health` public).

## Interactive cases

| ID | Scenario | Steps | Expected | Tool | Result |
|----|----------|-------|----------|------|--------|
| T1 | auth-session: First sign-in (dev, console transport) | 1. `npm run dev` 2. open http://localhost:3000 3. enter an email 4. copy the link printed in the terminal banner 5. open it | Redirected to `/sign-in`, then "check your email", then signed-in landing with the email as name; link appears only in the terminal banner, not in `logs/app.log` | playwright | pass (2026-11-19, dev server on :3300 with console transport: banner in the terminal, 0 occurrences in the log file; link → signed in, name `t1.author` = local part of the address, see design §16) |
| T2 | auth-session: Used link | Open the T1 link again | `/sign-in/error` with "link no longer valid"; `auth.link.invalid` warn | playwright | pass (`/sign-in/error?error=INVALID_TOKEN`, "That link no longer works", `auth.link.invalid` reason `invalid`) |
| T3 | auth-session: Signed-out redirect + `next` | Sign out, open `/settings`, sign in again via a new link | Redirect to `/sign-in?next=/settings`; after sign-in lands on `/settings` | playwright | pass (curl 307 → `/sign-in?next=%2Fsettings`; full browser round trip in `tests/e2e/auth.spec.ts`) |
| T4 | auth-session: Foreign `next` | Open `/sign-in?next=//example.com` and sign in | Lands on `/`, not example.com | playwright | pass (sign-in page passes `next="/"` to the form; Better Auth itself also answers 403 to a foreign `callbackURL`) |
| T5 | auth-session: Rate limit | `for i in 1..6: curl -X POST /api/auth/sign-in/magic-link -d '{"email":"a@b.co"}'` | 5 × 200, 6th 429; `auth.rate_limited` warn; 5 messages only | http | pass (limit reached after 5 per client incl. earlier requests; 429 logged as `auth.rate_limited` (added during test); spoofed `X-Forwarded-For` / client-ip headers don't reset it) |
| T6 | auth-session: Access refusal | Signed-out `curl` of the settings action / `GET /api/auth/get-session` | Server action redirects to sign-in; get-session returns null; nothing changes | http | pass (get-session `null`, `/settings` 307 to sign-in; action refusals in `access.test.ts`) |
| T7 | auth-session: Admin role | Put your email in `ADMIN_EMAILS`, sign in; remove it, sign in again | `auth.role.synced` admin, then user; DB `role` column matches | console | pass (listed as `Boss@Example.com` → admin; removed → user; one `auth.role.synced` each) |
| T8 | account-management: Rename | Settings → name "Rafael" → save; then empty name | Header shows Rafael; empty → validation message, name unchanged | playwright | pass (`tests/e2e/auth.spec.ts`: "Saved." and header updated; blank → "Enter a name") |
| T9 | account-management: Delete + purge | Settings → Delete → type `DELETE` → confirm, with `npm run worker` running | `/goodbye`; user/session/account rows gone; worker logs `account.purge.step` + `account.purge.done` with the user id | playwright + console | pass (browser flow in e2e; with the worker running, the queued job 182bf885… was purged for that user id, `steps: 0` until later epics register steps) |
| T10 | auth-session: Google | With real `GOOGLE_CLIENT_ID/SECRET` (and redirect URI `http://localhost:3000/api/auth/callback/google`), "Continue with Google" | Signed in; same account as the email sign-in for that address | manual | todo |
| T11 | CI | Push `epic/e01-auth` (with the author's OK) | All CI jobs green | manual | pass (2026-11-19, run 44602358504: `check` and `image` green; the first run failed the image build — `next build` typechecked `playwright.config.ts`, whose `tests/` import isn't in the image context — fixed by keeping test configs out of `.dockerignore`d context) |

## Observability checks

- [x] `storyforge:auth` emits `auth.magic_link.requested` with `emailHash` (no email), `auth.sign_in` with `userId` and `method` (new accounts: `auth.user.created`), `auth.sign_out` (T1, T3)
- [x] `auth.link.invalid` (T2), `auth.rate_limited` (T5), `auth.role.synced` only when the role changes (T7)
- [x] `storyforge:access` emits `access.denied` with `reason` and `op` for refusals (T6, integration)
- [x] `storyforge:account` emits `account.name.updated`, `account.delete.requested`, `account.deleted`, `account.delete.refused` (T8, T9)
- [x] `storyforge:jobs` / worker emit `jobs.enqueued`, `account.purge.step`, `account.purge.done` with `jobId` and originating `requestId` (T9)
- [x] Better Auth's own warnings appear under `storyforge:auth` with request ids (event `better_auth`, e.g. "Invalid callbackURL" with `requestId` ba-check-1)
- [x] No log line contains an email address, a sign-in link or token, a session id or `BETTER_AUTH_SECRET` (`log-hygiene.test.ts` + grep of the T1–T9 logs)

## Exit criteria

- [x] Automated tests green (`npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`)
- [ ] All interactive cases `pass` (T10 needs real Google credentials and may be done by the author; T11 needs the push)
- [x] Observability checks visible
- [x] Security items from design.md each covered by a passing test or case (server-side access checks and 404s, cookie flags, single-use expiring links, rate limits, fresh session for deletion, open-redirect protection, production transport rule, no secrets in logs)
- [x] No regressions in E00 (`service-health` suites green, `/api/health` public)
