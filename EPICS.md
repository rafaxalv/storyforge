# Epics — storyforge

Source: [PRD.md](PRD.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · Changes: `openspec/changes/` · Docs: `doc/`

**Naming rule (single source of truth):** epic `E0N` ⇒ OpenSpec change `e0N-<slug>` ⇒ branch `epic/e0N-<slug>` ⇒ doc `doc/<slug>.md`. Never renumber; append new epics at the end.

**Status legend:** `todo` → `planned` (change artifacts done, CP3 pending/passed) → `in-progress` (on branch, coding) → `verifying` (running test-plan) → `review` (docs done, waiting for CP4) → `done` (archived + merged). `dropped` for epics descoped.

**Reviewed:** — <!-- set to the date the human approved this epic list (CP2); clear it when epics change -->

**Assumptions** (from PRD §16, accepted at CP1)
- A1: Claude usage is paid by the operator's API key with per-user monthly caps; no bring-your-own-key in v1.
- A2: one author per project.
- A3: public libraries are visible to signed-in users only.
- A4: import/export formats are .docx and Markdown only.
- PRD Q1 (notify borrowers on library change?) → decided in E06 planning; default: notify only on unpublish/hide.
- PRD Q2 (whole-book review?) → chapters only in v1 (E07); whole-book is a later epic.
- The admin role (`user.role`) is introduced in E01 so E06 moderation and E08 caps can rely on it.
- M3 (editor) is kept as one epic; if planning shows > ~30 tasks, snapshots/history split off as a new epic appended at the end.

## Status board

| ID | Epic | Change | Depends on | Status | Doc |
|----|------|--------|------------|--------|-----|
| E00 | Scaffolding & environment | `e00-scaffold` | — | todo | — |
| E01 | Accounts & auth | `e01-auth` | E00 | todo | — |
| E02 | Projects & outline | `e02-outline` | E01 | todo | — |
| E03 | Manuscript editor | `e03-editor` | E02 | todo | — |
| E04 | Private reference libraries | `e04-libraries` | E03 | todo | — |
| E05 | Claude inline edit & usage metering | `e05-inline-edit` | E03 | todo | — |
| E06 | Public libraries | `e06-public-libraries` | E04 | todo | — |
| E07 | Claude structure review | `e07-structure-review` | E04, E05 | todo | — |
| E08 | Usage caps & admin | `e08-usage-caps` | E05 | todo | — |
| E09 | Import & export | `e09-import-export` | E03, E04 | todo | — |

## E00 — Scaffolding & environment

**Goal:** a runnable, testable, observable empty Next.js app so every later epic starts from a working baseline.

**User stories**
- **US-1** As a developer, I want a one-command local setup (`docker compose up -d && npm install && npm run dev`), so that any session can start the app immediately.
  - Acceptance: fresh clone → setup → run serves the app on localhost; steps documented in `doc/README.md`.
  - Acceptance: `npm run worker` starts the pg-boss worker and logs that it is ready.
- **US-2** As an AI agent or on-call human, I want a logging baseline, so that any feature can be debugged from its logs.
  - Acceptance: `log(name)` returns a pino child logger named `storyforge:<module>`; `LOG_LEVEL` switches level; output goes to stdout and `logs/app.log` locally.
  - Acceptance: every HTTP request produces one `request` log line with `requestId`, route, status and duration; an incoming `x-request-id` is reused.
- **US-3** As an operator, I want `GET /api/health`, so that I can see the app version and whether the database is reachable.
  - Acceptance: returns 200 `{version, db:"ok"}` with Postgres up and 503 `{db:"error"}` with it down.
- **US-4** As a developer, I want a test harness and CI, so that every epic ships with green tests.
  - Acceptance: `npm test` runs a unit and an integration (Postgres) example; `npm run test:e2e` runs a Playwright example; GitHub Actions runs lint, typecheck, tests and e2e on push.
- **US-5** As a developer, I want the Claude seam in place, so that features never call the SDK directly and tests never hit the network.
  - Acceptance: `src/server/ai/client.ts` exposes a client interface with a real implementation and `FakeClaude` that replays fixtures; tests use the fake by default.

**Scope:** Next.js 15 + TS strict, ESLint/Prettier, Drizzle + first (empty) migration, docker compose (Postgres, MinIO), pino logger + request-id middleware (AsyncLocalStorage), pg-boss worker entrypoint, Vitest + Playwright, GitHub Actions, Dockerfile (web/worker roles), `.env.example`, Claude client seam + FakeClaude, `/api/health`.
**Out of scope:** auth (E01), any product UI beyond a placeholder home page.
**Depends on:** —
**Notes:** PRD M0, NFR-3/NFR-4 baselines, ARCHITECTURE §2, §3 layout, §8, §9. Has behavior → spec capability `service-health` (health endpoint + request log line). Docker must be installed locally before this epic's tests can run.

## E01 — Accounts & auth

**Goal:** authors can sign up, sign in and delete their account, and every server function knows who the actor is.

**User stories**
- **US-1** As an author, I want to sign in with an email magic link or Google, so that my work is tied to me.
  - Acceptance: magic link email (console transport locally) signs the user in; Google OAuth signs in; session persists 30 days; sign-out works.
  - Acceptance: signed-out users are redirected to sign-in from every app page.
- **US-2** As an author, I want to set my display name and delete my account, so that I control my data.
  - Acceptance: display name editable; deletion asks for confirmation, signs out, and a purge job removes all the user's rows.
- **US-3** As a developer, I want `getActor()` and an ownership helper, so that every domain function enforces access the same way.
  - Acceptance: domain functions without a valid actor throw `Unauthenticated`; accessing another user's row throws `Forbidden`; covered by an integration test pattern later epics copy.
- **US-4** As an operator, I want an admin role set by config, so that moderation and caps can be restricted to admins.
  - Acceptance: emails listed in `ADMIN_EMAILS` get `role=admin` on sign-in; `requireAdmin()` guards admin routes.

**Scope:** Auth.js v5 + Drizzle adapter, user table (name, role, monthly_token_cap nullable), sign-in/out pages, settings page, account purge job, test auth provider for e2e, auth rate limiting.
**Out of scope:** account data export (E09), usage caps UI (E08).
**Depends on:** E00
**Notes:** FR-1–3, FR-34 (role only), NFR-4. Capabilities: `auth-session`, `account-management`. Security rules: owasp-2025 (A01, A07), typescript.

## E02 — Projects & outline

**Goal:** an author can create projects and shape a book's structure of chapters and scenes.

**User stories**
- **US-1** As an author, I want to create, rename and delete projects, so that each book has its own space.
  - Acceptance: project list shows title, word count, last edited; delete is soft and recoverable for 30 days.
- **US-2** As an author, I want to add, rename, delete and drag-reorder chapters and scenes (also moving scenes between chapters), so that the structure follows my outline.
  - Acceptance: order persists after reload; keyboard reordering works; deleted nodes are recoverable from a trash view.
- **US-3** As an author, I want to see word counts per scene, chapter and project and set a project target, so that I can track progress.
  - Acceptance: counts update when scene text changes (seeded text until E03); target shows a progress bar.

**Scope:** project/chapter/scene tables and domain module, outline sidebar UI with drag-and-drop, trash/restore, purge job for expired soft deletes, word-count aggregation.
**Out of scope:** scene text editing (E03), style sheet (E03).
**Depends on:** E01
**Notes:** FR-4, FR-8, NFR-1 (outline < 1 s for 200k words), NFR-6. Capabilities: `project-management`, `manuscript-outline`.

## E03 — Manuscript editor

**Goal:** an author can write scenes in a rich-text editor that never loses work and keeps a history.

**User stories**
- **US-1** As an author, I want a rich-text editor with paragraphs, headings, emphasis, block quotes, scene breaks and inline author notes, so that I can draft comfortably.
  - Acceptance: TipTap editor with those nodes; author notes are visually distinct and excluded from word counts.
- **US-2** As an author, I want automatic saving with visible status, so that I never lose work.
  - Acceptance: saves within 2 s of the last keystroke; shows saving/saved/error; a failed save retries and is not dropped; reload shows the latest text.
- **US-3** As an author, I want to be warned when the same scene was changed in another tab, so that I don't overwrite my own work.
  - Acceptance: stale version save is rejected; UI offers reload or overwrite.
- **US-4** As an author, I want to browse earlier versions of a scene and restore one.
  - Acceptance: auto snapshots at most every 10 min while editing plus manual "save version"; preview and restore (restore itself creates a snapshot).
- **US-5** As an author, I want a project style sheet (POV, tense, voice notes), so that Claude features can follow it later.
  - Acceptance: style sheet editable in project settings and stored on the project.

**Scope:** TipTap setup + custom nodes, scene doc/text/word_count/version columns, autosave client queue, optimistic concurrency, snapshots table and UI, style sheet form.
**Out of scope:** entry mention links (E04), AI-assisted markers (E05).
**Depends on:** E02
**Notes:** FR-5–7, FR-9–10, NFR-1, NFR-3, NFR-6. Capabilities: `scene-editor`, `scene-history`, `project-style-sheet`. Risk: largest epic; see Assumptions on splitting.

## E04 — Private reference libraries

**Goal:** an author can keep structured reference material and see it beside the manuscript.

**User stories**
- **US-1** As an author, I want libraries with entries of type character, place, item, faction, event, note or source (title, aliases, rich body, tags, custom fields), so that I can organise my world and research.
  - Acceptance: CRUD for libraries and entries; custom fields as key/value rows.
- **US-2** As an author, I want to search and filter entries by text, type and tag, so that I find things fast.
  - Acceptance: Postgres full-text search over title, aliases, body; results in < 300 ms for 2,000 entries.
- **US-3** As an author, I want to attach libraries to a project and open entries in a side panel while writing.
  - Acceptance: attach/detach from project settings; side panel lists and searches attached entries without leaving the editor.
- **US-4** As an author, I want to link a mention in my text to an entry, so that I can jump to it.
  - Acceptance: `@` menu in the editor inserts an entry mention; clicking opens it in the side panel.

**Scope:** library/library_entry/project_library tables, library pages, entry editor (reusing TipTap), search, side panel, mention node.
**Out of scope:** publishing and browsing public libraries (E06), export (E09).
**Depends on:** E03 (side panel and mention node live in the editor)
**Notes:** FR-11–14. Capabilities: `reference-library`, `library-search`, `project-libraries`.

## E05 — Claude inline edit & usage metering

**Goal:** an author can ask Claude to rework a selected passage and accept or reject the result as a diff; every Claude call is metered.

**User stories**
- **US-1** As an author, I want to select text and choose rewrite, tighten, expand, change tone, fix grammar or a custom instruction, so that I get a focused suggestion.
  - Acceptance: actions available from a selection toolbar and keyboard shortcut for selections of 1–4,000 words.
- **US-2** As an author, I want the suggestion to stream in as a word diff that I can accept, reject or retry, so that I stay in control of my text.
  - Acceptance: first tokens < 3 s p95 (real model); accept replaces the selection as one undo step and is marked AI-assisted in the scene history; retry accepts an extra instruction.
- **US-3** As an author, I want Claude to follow my style sheet and the surrounding text.
  - Acceptance: prompt includes style sheet and ≤ ~2,000 words of context; author notes excluded; verified by prompt-assembly unit tests.
- **US-4** As an author, I want to see my Claude usage this month.
  - Acceptance: settings shows tokens used by feature this month.
- **US-5** As an operator, I want every Claude call recorded, so that cost is visible.
  - Acceptance: `ai_usage` row per call with tokens, cache tokens, model, cost estimate and Anthropic request id; refusals and errors logged and shown as retryable messages.

**Scope:** `ai.call()` wrapper (logging, metering, error mapping, refusal handling, server-side fallbacks), inline-edit prompt + SSE route, selection toolbar, diff view, ai_usage table, user usage view, eval script for inline edit.
**Out of scope:** caps enforcement (E08), structure review (E07).
**Depends on:** E03
**Notes:** FR-20–23, FR-29, FR-31 (user view), NFR-2, NFR-5, NFR-9. ARCHITECTURE §7: `claude-opus-5-5`, effort low, streaming. Capabilities: `ai-inline-edit`, `ai-usage-metering`. Security rules: ai-security (prompt injection via manuscript text).

## E06 — Public libraries

**Goal:** authors can publish libraries and other authors can find, read, attach or copy them.

**User stories**
- **US-1** As a worldbuilder, I want to publish a library with title, description, optional cover and licence, and unpublish it later.
  - Acceptance: publish/unpublish toggle; cover uploaded to object storage; unpublishing removes it from browse and makes live attachments unavailable with an in-app notice to borrowers.
- **US-2** As a borrower, I want to browse and search public libraries and read their entries.
  - Acceptance: browse page with search by title, description, tags and author; library page lists entries; private libraries never appear.
- **US-3** As a borrower, I want to attach a public library to my project (live, read-only) or copy it into a private library, so that I can use it while writing.
  - Acceptance: attached public entries appear read-only in the side panel; copy creates an editable private library owned by the borrower.
- **US-4** As any user I want to report a library, and as an admin I want to hide or restore reported libraries.
  - Acceptance: report form with reason; admin queue; hidden libraries behave as unpublished for everyone but the owner.

**Scope:** visibility/licence/cover fields, publish flow, browse/search pages, attach-public and copy flows, report table and admin moderation page, borrower notices.
**Out of scope:** public web (signed-out) access (assumption A3), change notifications beyond unpublish/hide (PRD Q1).
**Depends on:** E04
**Notes:** FR-15–19, FR-34 (moderation), NFR-4, NFR-5. Capabilities: `public-libraries`, `library-moderation`. Risk: cross-user data exposure; integration tests for every visibility rule.

## E07 — Claude structure review

**Goal:** an author can get a structured review of a chapter's structure and work through the findings.

**User stories**
- **US-1** As an author, I want to request a review of a chapter and keep writing while it runs.
  - Acceptance: request returns immediately; review runs in the worker; UI shows queued/running/done/failed; ≤ 10k-word chapter completes < 2 min p95 (real model).
- **US-2** As an author, I want findings by category (pacing, scene turn, plant without payoff, payoff without plant, arc, POV/tense, clarity, other) and severity, each tied to a scene with explanation and suggestion.
  - Acceptance: structured output validated against the schema; invalid output fails the review with a logged reason, never partial garbage.
- **US-3** As an author, I want to click a finding to jump to the quoted passage and mark findings resolved or dismissed.
  - Acceptance: quote anchoring highlights the passage, falls back to the scene when the quote no longer exists; state persists.
- **US-4** As an author, I want the review to use my attached libraries and earlier chapters, and to re-run it after revising.
  - Acceptance: prompt includes referenced entries and earlier-chapter context within budget; cached prefix reused on re-runs (cache read tokens > 0 logged); old reviews stay readable.

**Scope:** review/review_finding tables, review job handler, prompt builder with cache breakpoints and earlier-chapter summaries, JSON-schema structured output, findings panel UI, anchoring, eval script for reviews.
**Out of scope:** whole-book review (PRD Q2), continuity checks (post-v1).
**Depends on:** E04, E05
**Notes:** FR-24–28, NFR-2, NFR-9. ARCHITECTURE §4 (background path), §7 (effort high, structured output, caching). Capabilities: `ai-structure-review`. Uses `narrative` categories from the PRD; prompt quality validated with the eval set before CP4.

## E08 — Usage caps & admin

**Goal:** the operator can bound Claude cost per user and see usage across users.

**User stories**
- **US-1** As an operator, I want a default monthly token cap and per-user overrides.
  - Acceptance: `AI_DEFAULT_MONTHLY_TOKENS` env default; admin can set an override per user.
- **US-2** As an author, I want to be told clearly when I have reached my cap, so that I know why Claude is unavailable.
  - Acceptance: inline edit and review requests over cap are refused before calling Claude with a message showing the reset date; in-flight requests finish; refusals by Claude don't count.
- **US-3** As an operator, I want a usage page per user and feature for the current and previous months.
  - Acceptance: admin page lists users with tokens and estimated cost; sortable.

**Scope:** quota check in `ai.call()` path and review enqueue, admin usage page, cap override UI, `quota.refused` log line.
**Out of scope:** payments/plans (non-goal).
**Depends on:** E05
**Notes:** FR-30, FR-31 (admin), FR-34 (caps), NFR-8. Capability: `ai-usage-caps`.

## E09 — Import & export

**Goal:** authors can bring an existing manuscript in and take their work out.

**User stories**
- **US-1** As an author, I want to import a .docx or Markdown manuscript, split into chapters and scenes, with a preview before it is created.
  - Acceptance: Heading 1 → chapter; `***`, `#` or Heading 2 → scene; preview shows the structure and word counts; confirm creates a new project.
- **US-2** As an author, I want to export a project to .docx and Markdown, with author notes excluded.
  - Acceptance: export job produces a downloadable file; formatting (headings, emphasis, scene breaks) preserved.
- **US-3** As an author, I want to export a library to Markdown (one file per entry, zipped).
  - Acceptance: zip download with front matter for type, tags and fields.

**Scope:** mammoth-based docx import, Markdown parser, preview UI, export jobs (docx, md, zip) via worker and object storage, download links.
**Out of scope:** other formats (assumption A4), account-wide data export beyond projects and libraries.
**Depends on:** E03, E04
**Notes:** FR-32–33, NFR-5 (users can take their data). Capabilities: `manuscript-import`, `content-export`.

## Dependency graph

```
E00 → E01 → E02 → E03 ─┬→ E04 ─┬→ E06
                       │       ├→ E07
                       │       └→ E09
                       └→ E05 ─┬→ E07
                               └→ E08
```

## Parallelization

| Wave | Epics | Notes |
|------|-------|-------|
| 1 | E00 | must finish first |
| 2 | E01 | |
| 3 | E02 | |
| 4 | E03 | |
| 5 | E04, E05 | independent once E03 is done |
| 6 | E06, E07, E08, E09 | E06, E09 need E04; E08 needs E05; E07 needs both |
