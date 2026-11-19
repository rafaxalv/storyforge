# Epics — storyforge

Source: [PRD.md](PRD.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · Changes: `openspec/changes/` · Docs: `doc/`

**Naming rule (single source of truth):** epic `E0N` ⇒ OpenSpec change `e0N-<slug>` ⇒ branch `epic/e0N-<slug>` ⇒ doc `doc/<slug>.md`. Never renumber; append new epics at the end.

**Status legend:** `todo` → `planned` (change artifacts done, CP3 pending/passed) → `in-progress` (on branch, coding) → `verifying` (running test-plan) → `review` (docs done, waiting for CP4) → `done` (archived + merged). `dropped` for epics descoped.

**Reviewed:** 2026-11-18

**Assumptions**
- This list replaces the first one (generic writing desk, reviewed 2026-11-17) after the PRD was reworked as the cowriter successor. No epic past E00 had been planned, so ids E01–E09 are reused with new meanings; from now on ids are never reused.
- PRD A1–A6 apply (operator-paid Claude with caps; one author per book; admin-curated public library; cowriter skills as of 2026-11-17; fixed 31-dimension framework; web research, heatmap, chat panel, graph, PDF and translation tools after v1).
- PRD Q1 (primary home after import) → default: storyforge becomes the book's home after import; re-import replaces a book after a warning, no merge in v1. Revisit in E07 planning.
- PRD Q2 (Desk-only data: scene-review ticks, lab tests, chats) → not imported in v1; they live in the Desk's artifact store, not the repo.
- Library and voices come before the plan (PRD milestone order M3–M5) because scene cards reference scenarios, characters and voice ranges.
- E06 (draft editor) and E07 (import/export) are the largest epics. If planning shows > ~30 tasks, E06 splits off reader view + promote, and E07 splits export from import, each appended as a new epic at the end.

## Status board

| ID | Epic | Change | Depends on | Status | Doc |
|----|------|--------|------------|--------|-----|
| E00 | Scaffolding & environment | `e00-scaffold` | — | done | [scaffold.md](doc/scaffold.md) |
| E01 | Accounts & auth | `e01-auth` | E00 | done | [auth.md](doc/auth.md) |
| E02 | Book profile & structure | `e02-book-profile` | E01 | planned | [book-profile.md](doc/book-profile.md) |
| E03 | Private library | `e03-private-library` | E02 | todo | — |
| E04 | Voices & chapter writing styles | `e04-voices` | E03 | todo | — |
| E05 | Chapter plan & scene cards | `e05-plan-scenes` | E03, E04 | todo | — |
| E06 | Drafts & manuscript editor | `e06-draft-editor` | E04, E05 | todo | — |
| E07 | Cowriter import & export | `e07-cowriter-io` | E06 | todo | — |
| E08 | Claude foundation, inline edit & usage metering | `e08-ai-foundation` | E06 | todo | — |
| E09 | Public library & voice lab | `e09-public-library-lab` | E04, E08 | todo | — |
| E10 | Readiness & scene builder | `e10-scene-builder` | E05, E08 | todo | — |
| E11 | Drafting | `e11-drafting` | E10 | todo | — |
| E12 | Texture measures & rewrite to voice | `e12-texture-rewrite` | E06, E08 | todo | — |
| E13 | Prose review | `e13-prose-review` | E11, E12 | todo | — |
| E14 | Usage caps & admin | `e14-usage-caps` | E08 | todo | — |

## E00 — Scaffolding & environment

**Goal:** a runnable, testable, observable empty Next.js app so every later epic starts from a working baseline.

**User stories**
- **US-1** As a developer, I want a one-command local setup (`docker compose up -d && npm install && npm run dev`), so that any session can start the app immediately.
  - Acceptance: fresh clone → setup → run serves the app on localhost; steps in `doc/README.md`.
  - Acceptance: `npm run worker` starts the pg-boss worker and logs that it is ready.
- **US-2** As an AI agent or on-call human, I want a logging baseline, so that any feature can be debugged from its logs.
  - Acceptance: `log(name)` returns a pino child logger named `storyforge:<module>`; `LOG_LEVEL` switches level; stdout and `logs/app.log` locally; startup banner with version, env, level.
  - Acceptance: every HTTP request logs one `request` line with `requestId`, route, status, duration; an incoming `x-request-id` is reused and returned.
- **US-3** As an operator, I want `GET /api/health`, so that I can see the app version and whether the database is reachable.
  - Acceptance: 200 `{version, db:"ok"}` with Postgres up; 503 `{db:"error"}` with it down.
- **US-4** As a developer, I want a test harness and CI, so that every epic ships with green tests.
  - Acceptance: `npm test` runs unit + integration (Postgres) examples; `npm run test:e2e` runs a Playwright example; GitHub Actions runs lint, typecheck, tests, e2e on push.
- **US-5** As a developer, I want the Claude seam and the framework constants in place, so that features never call the SDK directly and share one definition of the style framework.
  - Acceptance: `src/server/ai/client.ts` exposes a client interface with a real implementation and `FakeClaude` replaying fixtures; tests use the fake by default.
  - Acceptance: `src/shared/framework.ts` defines the tags and the 31 dimensions (groups A–G, poles, language-sensitive and scene-level sets) with a unit test.

**Scope:** Next.js 15 + TS strict, ESLint/Prettier, Drizzle + empty first migration, docker compose (Postgres, MinIO), pino + request-id middleware, pg-boss worker entrypoint, Vitest + Playwright, GitHub Actions, Dockerfile (web/worker), `.env.example`, Claude client seam + FakeClaude, framework constants, `/api/health`.
**Out of scope:** auth (E01), any product UI beyond a placeholder page.
**Depends on:** —
**Notes:** PRD M0; ARCHITECTURE §2, §3 layout, §8, §9. Behavior → capability `service-health` (health endpoint + request log line). Docker must be installed locally for this epic's tests.

## E01 — Accounts & auth

**Goal:** authors can sign in and delete their account, and every server function knows who the actor is.

**User stories**
- **US-1** As an author, I want to sign in with an email magic link or Google, so that my books are mine.
  - Acceptance: magic link (console transport locally) and Google OAuth sign in; session lasts 30 days; sign-out works; app pages redirect signed-out users.
- **US-2** As an author, I want to delete my account, so that I control my data.
  - Acceptance: confirmation, sign-out, purge job removes every row and stored file of the user.
- **US-3** As a developer, I want `getActor()`, ownership and admin helpers, so that every domain function enforces access the same way.
  - Acceptance: no actor → `Unauthenticated`; another user's row → `Forbidden`; `ADMIN_EMAILS` grants `role=admin`; an integration-test pattern later epics copy.

**Scope:** Better Auth + Drizzle adapter (changed from Auth.js v5 on 2026-11-19: still beta), user table (role, monthly_token_cap), sign-in/out pages, settings page, account purge job, e2e sign-in through an email outbox folder, auth rate limits.
**Out of scope:** usage UI (E08, E14).
**Depends on:** E00
**Notes:** FR-1–3, NFR-4. Capabilities: `auth-session`, `account-management`.

## E02 — Book profile & structure

**Goal:** an author can create a book with its profile, languages, parts, chapters and Concept.

**User stories**
- **US-1** As an author, I want to create a book and edit its profile (title, one-liner, length target and limit, languages with the written-first flag, standing rules, truth labels, people notes, paragraph-ID scheme), so that every tool follows it.
  - Acceptance: profile page with those fields; languages can be added/reordered; standing rules numbered and dated; default truth labels from cowriter (DOCUMENTED … FICTIONAL).
- **US-2** As an author, I want parts and chapters with ids from the scheme (`01`, `00` prologue, `99` epilogue, `INT`) and a title per language, so that the book's shape is set.
  - Acceptance: create, rename, reorder, remove (restorable); reordering never changes chapter ids; a book outline view.
- **US-3** As an author, I want to write the Concept and open it beside other pages.
  - Acceptance: rich-text Concept with autosave; side-panel view.

**Scope:** book, book_language, standing_rule, concept, part, chapter tables + domain module; book list, profile, outline and concept pages; `src/shared/id-scheme.ts`.
**Out of scope:** plan items (E05), paragraphs (E06).
**Depends on:** E01
**Notes:** FR-4–6. Capabilities: `book-profile`, `book-structure`.

## E03 — Private library

**Goal:** an author can keep a book's research, characters, continuity, scenarios and lexicon in storyforge.

**User stories**
- **US-1** As an author, I want research documents in folders (Markdown edited in-app, PDFs and images uploaded) with truth labels, so that sources live with the book.
  - Acceptance: folder tree; Markdown editor; PDF/image upload to object storage with preview; truth label per document; "cited by" list (filled once E05 lands).
- **US-2** As an author, I want a Character Bible (characters by stage and group, bullets, chapter pointers, a speech-voice slot) and a Continuity record linked to paragraph ids.
  - Acceptance: CRUD for characters and continuity facts by category; paragraph refs stored as ids (resolved to links once E06 lands).
- **US-3** As an author, I want scenarios (place, period, spots, anachronism traps, established-in-text) and a colour script.
  - Acceptance: CRUD; spots addressable as `scenario#spot` for scene cards.
- **US-4** As an author, I want a Bilingual Lexicon with a term and reader note per book language.
  - Acceptance: CRUD; ASCII key validated; lookup by key used later by footnotes.

**Scope:** research_folder/research_doc, character, continuity_fact, scenario/scenario_spot, colour_script, lexicon_entry; library pages; upload handling with size and type limits.
**Out of scope:** public library (E09); Claude help on scenarios or speech voices (after v1).
**Depends on:** E02
**Notes:** FR-12–16, NFR-4 (upload safety). Capabilities: `research-library`, `character-bible`, `scenarios`, `bilingual-lexicon`.

## E04 — Voices & chapter writing styles

**Goal:** an author can define voices on the 31-dimension framework and set each chapter's voice and tuning.

**User stories**
- **US-1** As an author, I want to create and edit voices (id with the `NARR-`/`AUTHOR-`/`BASE-`/`CHAR-…-SPEECH`/`DOC-` scheme, type, tags, 31 dimensions with base/min/max/note), so that a voice is defined exactly as in cowriter.
  - Acceptance: framework-driven editor (groups A–G, pole labels, range bands); validation base within min–max, 1–5.
- **US-2** As an author, I want rule sets, the Texture section and one language layer per book language (references, offsets ±1 on 4/5/6/7/11 only, vocabulary, phrase-building, address, literacy markers, language rules, texture targets, reference paragraph).
  - Acceptance: offsets outside ±1 or on other dimensions are rejected; texture targets table keyed by cowriter's measure labels.
- **US-3** As an author, I want voices versioned with a change log, so that paragraphs can say which version wrote them.
  - Acceptance: saving a change creates a version; history list with diffs of dimensions.
- **US-4** As an author, I want to set each chapter's voice in use and, per voice, its tuning, reason, status and texture overrides.
  - Acceptance: sliders limited to the voice's range; outside requires a reason; 19/20/27–30 read-only at chapter level; switching the voice keeps every voice's settings; characters can be linked to speech voices.
- **US-5** As an author, I want a book Author Library (reference authors with 31 scores, reasons, portrait).
  - Acceptance: CRUD; link to a public author is optional until E09.

**Scope:** voice, voice_version, chapter_style, chapter_voice_setting, author_library_entry; voices index page, voice editor, chapter writing style panel.
**Out of scope:** blending and Claude tests (E09); texture measurement (E12).
**Depends on:** E03 (speech voices link to characters)
**Notes:** FR-17–21, A5. Capabilities: `voices`, `chapter-writing-style`, `author-library`.

## E05 — Chapter plan & scene cards

**Goal:** an author can keep each chapter's plan of record and its scene cards in storyforge.

**User stories**
- **US-1** As an author, I want a chapter plan with When / where, Readiness line, and ordered Stories, Facts, Notes and Sources items, so that the plan is my plan of record.
  - Acceptance: items editable in place; numbering (`3.`, `3.2`) and "How the chapter runs" first; facts with truth label, to-verify, cited sources; sources S1… linking to research docs; change origin recorded.
- **US-2** As an author, I want a panel of what is left to organise.
  - Acceptance: lists facts with no source or label, items to verify, sources nobody cites.
- **US-3** As an author, I want scene cards with the cowriter card fields and the six scene parameters.
  - Acceptance: card editor; Covers picks plan items and beats; Scenario picks a spot or marks `(missing)`; Characters picks Bible entries with their speech voice; out-of-range values for 19/20/27–30 require a reason; cards reorder and renumber `N.k`.

**Scope:** plan_item, scene_card tables; chapter plan page, scenes page, side panel with Concept and research.
**Out of scope:** Readiness scoring and building cards with Claude (E10).
**Depends on:** E03, E04
**Notes:** FR-7–11. Capabilities: `chapter-plan`, `scene-cards`.

## E06 — Drafts & manuscript editor

**Goal:** an author can write and revise chapter drafts per voice, in every language, without ever losing an edit, and read the manuscript as a book.

**User stories**
- **US-1** As an author, I want to edit a chapter's draft paragraph by paragraph (select, then edit), in one language or side by side, with ids, foldable scene separators, add below, remove/restore, review status and scene review ticks.
  - Acceptance: ids follow the scheme incl. letter suffixes; keyboard flow (Tab, Enter, Enter, Escape); first scene open, others folded.
- **US-2** As an author, I want drafts per narrator voice with a first text and a revised text, so that I can switch voices without losing either.
  - Acceptance: voice switch shows that voice's draft; "revised" marks paragraphs differing from the first text.
- **US-3** As an author, I want autosave that never loses an edit, conflict detection and history.
  - Acceptance: save ≤ 2 s after typing; per-paragraph+language version check; failed saves retried and kept across reload; conflict shows both texts; history with restore.
- **US-4** As an author, I want footnotes from the Lexicon, and to promote an approved draft into the manuscript.
  - Acceptance: `[^key]` markers resolve to the paragraph language's note; promote copies paragraphs with ids, keeps the previous manuscript in history.
- **US-5** As an author, I want a reader view (pages, font and size, page count, footnotes as symbols per page, scene breaks as a centred dash).
  - Acceptance: matches cowriter's Book tab behaviour on a fixture chapter.

**Scope:** draft, draft_version, paragraph, paragraph_text, paragraph_history, scene_review, manuscript container; draft page, reader page; client save queue.
**Out of scope:** Claude edits (E08+), .docx export (E07).
**Depends on:** E04, E05
**Notes:** FR-25–30, NFR-1, NFR-3, NFR-7. Capabilities: `draft-editor`, `manuscript`, `reader-view`. Largest UI epic; see Assumptions on splitting.

## E07 — Cowriter import & export

**Goal:** an existing cowriter book moves into storyforge faithfully and can be exported back.

**User stories**
- **US-1** As an author, I want to import a cowriter book from a zip or from the GitHub repo and path, with a dry run first, so that I can move grandgrandfather in.
  - Acceptance: dry-run report with counts per area, warnings and unparsed sections (kept as notes); commit creates the book; paragraph ids preserved; zip limits and path checks enforced.
- **US-2** As an author, I want to export a book to the cowriter layout and a chapter or the manuscript to .docx.
  - Acceptance: export of the fixture book re-imports with no differences in supported fields (round-trip test); .docx keeps headings, emphasis, scene breaks, footnotes.
- **US-3** As an operator, I want to import a cowriter repo's `library/` into the public library.
  - Acceptance: admin-only; authors, books (text, source, translator, PD status), STYLE.md and TEXTURE.md imported (stored now, shown in E09).

**Scope:** parsers for BOOK.md, concept, chapters files, scenes, scenarios, characters + continuity, research, voice files + index + chapter settings + author library + lexicon + shared rules, drafts, manuscript, paragraph parameters; exporters; GitHub fetch with the user's token (not stored); fixture book under `tests/fixtures/cowriter-book/`.
**Out of scope:** merging a re-import into edited data (Q1 default: replace with warning); Desk-only data (Q2).
**Depends on:** E06
**Notes:** FR-39–41, NFR-6. Capabilities: `cowriter-import`, `cowriter-export`. Risk: format variance; see Assumptions on splitting.

## E08 — Claude foundation, inline edit & usage metering

**Goal:** the machinery every Claude feature uses exists and is proven by inline edit.

**User stories**
- **US-1** As a developer, I want `ai.call()`, the brief builder, the Claude job runner and the proposal model, so that later features only add prompts and mappings.
  - Acceptance: jobs with progress over SSE and cancel; proposals with typed items, accept/reject per item, apply in one transaction with undo; brief builder with cache breakpoints (cache reads logged); refusals and fallbacks handled.
- **US-2** As an author, I want to select text and ask Claude to rewrite, tighten, expand, change tone, fix grammar or follow a custom instruction, and accept or reject a streamed diff.
  - Acceptance: 1–4,000 words; first tokens < 3 s p95 (real model); accept = one undo step, recorded as `ai:inline-edit` in paragraph history.
- **US-3** As an author and operator, I want every Claude call recorded and my month's usage visible.
  - Acceptance: `ai_usage` row per call; usage page per feature.

**Scope:** ai/client, ai/brief, ai/proposals, job_run, proposal tables, proposal review UI, inline-edit route + UI, ai_usage + user usage view, `eval:inline-edit` script.
**Out of scope:** caps (E14).
**Depends on:** E06
**Notes:** FR-34, FR-42, NFR-2, NFR-4 (prompt injection), ARCHITECTURE §4, §7. Capabilities: `ai-proposals`, `ai-inline-edit`, `ai-usage-metering`.

## E09 — Public library & voice lab

**Goal:** authors can draw on curated reference authors to build voices and test them with Claude.

**User stories**
- **US-1** As an operator, I want to manage public authors, books, style studies and texture profiles.
  - Acceptance: admin pages; PD status incl. "BR only"; in-copyright authors without text.
- **US-2** As an author, I want to browse and read the public library and add an author to my book's Author Library.
  - Acceptance: search by name and language; style study and texture profile readable; add copies scores and links the study.
- **US-3** As an author, I want the voice lab: choose authors with weights, Blend (weighted base, ranges ±1), adjust, draft rules with Claude, and generate test paragraphs from a chapter's plan in one or both languages.
  - Acceptance: blend maths unit-tested; tests stored and comparable side by side; Claude rules arrive as a proposal; tests never enter drafts.

**Scope:** public_author, public_book, style_study, texture_profile (UI over data imported in E07), voice lab page, `voice-lab-test` and `voice-rules` features.
**Out of scope:** downloading books from the web (after v1).
**Depends on:** E04, E08
**Notes:** FR-22–24. Capabilities: `public-library`, `voice-lab`.

## E10 — Readiness & scene builder

**Goal:** Claude scores a chapter's readiness and builds its scene cards from the plan, under the author's approval.

**User stories**
- **US-1** As an author, I want Claude to score Readiness with the six-parameter rubric and explain the weakest parameters.
  - Acceptance: weights 25/20/10/15/15/15; voice ≤ 2 and total ≤ 79 when tuning is not settled; Readiness line written on accept.
- **US-2** As an author, I want scene cards built automatically or through a brainstorm, with the review report.
  - Acceptance: refuses below 60; asks questions on weakest parameters at 60–79; report lists story lines covered/thin/missing, checks, narrative review at card level; shape fixes applied, story and plan changes as proposals accepted one by one.

**Scope:** `readiness` and `scene-builder` features (prompts from cowriter's readiness.md and scene-builder skill), brainstorm step UI, report view.
**Out of scope:** research lookups (non-goal).
**Depends on:** E05, E08
**Notes:** FR-31–32. Capabilities: `ai-readiness`, `ai-scene-builder`.

## E11 — Drafting

**Goal:** Claude writes a chapter draft from its scene cards in the chapter's voice, in every language.

**User stories**
- **US-1** As an author, I want a chapter draft written from its cards and covered plan items, in the voice, tuning and texture, natively in each book language (written-first language first).
  - Acceptance: paragraphs with ids per scheme, scene markers, footnote markers for lexicon terms; arrives as a proposal; accept creates the voice's first text (and revised text); progress per scene; cancel keeps nothing.
- **US-2** As an author, I want drafting to refuse when the chapter is not ready.
  - Acceptance: requires cards and a settled tuning; clear message otherwise.

**Scope:** `drafting` feature, per-scene generation steps, assembly into paragraphs, eval set from grandgrandfather material.
**Out of scope:** translation of existing text (after v1).
**Depends on:** E10
**Notes:** FR-33. Capability: `ai-drafting`.

## E12 — Texture measures & rewrite to voice

**Goal:** the texture of a chapter is measured against its voice, and Claude can rewrite paragraphs to the chapter's tuning.

**User stories**
- **US-1** As an author, I want a texture check of a chapter's narration per language against the voice's targets moved by the chapter tuning, with pattern-cap counts.
  - Acceptance: TypeScript port of `texture.py` measures, `TARGET_LABELS`, `TUNING_SHIFTS`; golden tests match the Python outputs on fixture texts; report marks measures out of range.
- **US-2** As an author, I want Apply to chapter / paragraph to rewrite paragraphs written before the current tuning, in every language, with what changed, what to check, and Undo.
  - Acceptance: one proposal item per paragraph streamed as it lands; stop keeps done items; applied tuning recorded on each paragraph.

**Scope:** `src/server/texture`, texture report UI, `apply-tuning` feature.
**Out of scope:** heatmap (after v1).
**Depends on:** E06, E08
**Notes:** FR-35, FR-38. Capabilities: `texture-check`, `ai-apply-tuning`.

## E13 — Prose review

**Goal:** Claude reviews a written chapter as cowriter's review chain does, and the author applies what they accept.

**User stories**
- **US-1** As an author, I want a sense-and-flow review with the smallest fix per finding (move, merge, cut, bridge, rewrite).
  - Acceptance: findings table with ids, words, before/after; accepted fixes applied in every language; moved paragraphs keep their ids.
- **US-2** As an author, I want a chapter prose review: map vs scene cards, scenarios, plot and continuity, rules, dialogue voices, voice coherence, languages, rhythm, texture report, narrative review, paragraph suggestions and proposed Continuity facts.
  - Acceptance: report sections as in cowriter; each item accept/reject; accepted paragraph changes update text and paragraph parameters together; accepted facts go to the Continuity record.

**Scope:** `sense-and-flow` and `prose-review` features (chapter pass + paragraph passes), report UI, eval set.
**Out of scope:** engagement heatmap, chat panel.
**Depends on:** E11, E12
**Notes:** FR-36–37. Capabilities: `ai-sense-and-flow`, `ai-prose-review`.

## E14 — Usage caps & admin

**Goal:** the operator bounds Claude cost per user and sees usage across users.

**User stories**
- **US-1** As an operator, I want a default monthly token cap and per-user overrides.
  - Acceptance: env default; admin override per user.
- **US-2** As an author, I want a clear refusal when I hit my cap, before anything runs.
  - Acceptance: refused before calling Claude with the reset date; running jobs finish; refusals by Claude don't count.
- **US-3** As an operator, I want a usage page per user and feature.
  - Acceptance: current and previous month, tokens and estimated cost, sortable.

**Scope:** quota check in job enqueue and inline edit, admin usage page, `quota.refused` log line.
**Depends on:** E08
**Notes:** FR-43, NFR-9. Capability: `ai-usage-caps`.

## Dependency graph

```
E00 → E01 → E02 → E03 → E04 → E05 → E06 ─┬→ E07
                                          └→ E08 ─┬→ E09   (also needs E04)
                                                  ├→ E10   (also needs E05) → E11 ─┐
                                                  ├→ E12   (also needs E06) ───────┴→ E13
                                                  └→ E14
```

## Parallelization

| Wave | Epics | Notes |
|------|-------|-------|
| 1–7 | E00 → E01 → E02 → E03 → E04 → E05 → E06 | data model and editor, in order |
| 8 | E07, E08 | import/export and the Claude foundation, independent |
| 9 | E09, E10, E12, E14 | all need E08 |
| 10 | E11 | needs E10 |
| 11 | E13 | needs E11 + E12 |
