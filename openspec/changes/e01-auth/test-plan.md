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
| T1 | auth-session: First sign-in (dev, console transport) | 1. `npm run dev` 2. open http://localhost:3000 3. enter an email 4. copy the link printed in the terminal banner 5. open it | Redirected to `/sign-in`, then "check your email", then signed-in landing with the email as name; link appears only in the terminal banner, not in `logs/app.log` | playwright | todo |
| T2 | auth-session: Used link | Open the T1 link again | `/sign-in/error` with "link no longer valid"; `auth.link.invalid` warn | playwright | todo |
| T3 | auth-session: Signed-out redirect + `next` | Sign out, open `/settings`, sign in again via a new link | Redirect to `/sign-in?next=/settings`; after sign-in lands on `/settings` | playwright | todo |
| T4 | auth-session: Foreign `next` | Open `/sign-in?next=//example.com` and sign in | Lands on `/`, not example.com | playwright | todo |
| T5 | auth-session: Rate limit | `for i in 1..6: curl -X POST /api/auth/sign-in/magic-link -d '{"email":"a@b.co"}'` | 5 × 200, 6th 429; `auth.rate_limited` warn; 5 messages only | http | todo |
| T6 | auth-session: Access refusal | Signed-out `curl` of the settings action / `GET /api/auth/get-session` | Server action redirects to sign-in; get-session returns null; nothing changes | http | todo |
| T7 | auth-session: Admin role | Put your email in `ADMIN_EMAILS`, sign in; remove it, sign in again | `auth.role.synced` admin, then user; DB `role` column matches | console | todo |
| T8 | account-management: Rename | Settings → name "Rafael" → save; then empty name | Header shows Rafael; empty → validation message, name unchanged | playwright | todo |
| T9 | account-management: Delete + purge | Settings → Delete → type `DELETE` → confirm, with `npm run worker` running | `/goodbye`; user/session/account rows gone; worker logs `account.purge.step` + `account.purge.done` with the user id | playwright + console | todo |
| T10 | auth-session: Google | With real `GOOGLE_CLIENT_ID/SECRET` (and redirect URI `http://localhost:3000/api/auth/callback/google`), "Continue with Google" | Signed in; same account as the email sign-in for that address | manual | todo |
| T11 | CI | Push `epic/e01-auth` (with the author's OK) | All CI jobs green | manual | todo |

## Observability checks

- [ ] `storyforge:auth` emits `auth.magic_link.requested` with `emailHash` (no email), `auth.sign_in` with `userId`, `method`, `newUser`, `auth.sign_out` (T1, T3)
- [ ] `auth.link.invalid` (T2), `auth.rate_limited` (T5), `auth.role.synced` only when the role changes (T7)
- [ ] `storyforge:access` emits `access.denied` with `reason` and `op` for refusals (T6, integration)
- [ ] `storyforge:account` emits `account.name.updated`, `account.delete.requested`, `account.deleted`, `account.delete.refused` (T8, T9)
- [ ] `storyforge:jobs` / worker emit `jobs.enqueued`, `account.purge.step`, `account.purge.done` with `jobId` and originating `requestId` (T9)
- [ ] Better Auth's own warnings appear under `storyforge:auth` with request ids (`LOG_LEVEL=debug`)
- [ ] No log line contains an email address, a sign-in link or token, a session id or `BETTER_AUTH_SECRET` (`log-hygiene.test.ts` + grep of `logs/app.log` after T1–T9)

## Exit criteria

- [ ] Automated tests green (`npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`)
- [ ] All interactive cases `pass` (T10 needs real Google credentials and may be done by the author; T11 needs the push)
- [ ] Observability checks visible
- [ ] Security items from design.md each covered by a passing test or case (server-side access checks and 404s, cookie flags, single-use expiring links, rate limits, fresh session for deletion, open-redirect protection, production transport rule, no secrets in logs)
- [ ] No regressions in E00 (`service-health` suites green, `/api/health` public)
