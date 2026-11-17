# storyforge — Product Requirements

Status: draft for review · 2026-11-17

## 1. Overview & vision

storyforge is a hosted writing desk for authors of long-form fiction and narrative non-fiction. It puts three things in one place: a **manuscript editor** organised as book → chapter → scene, **reference libraries** that hold everything an author keeps beside the manuscript (characters, places, lore, research, sources), and **Claude** as an assistant that works on the author's text on request and never writes it unprompted.

Libraries can be **private** (only the author) or **public** (published so other storyforge users can browse them and attach them to their own projects). Fan-fiction writers, shared-world anthologies and authors who publish their own worldbuilding bible are the reason public libraries exist.

## 2. Goals / non-goals

### Goals (v1)
- G1. An author can write and organise a full-length manuscript in the browser without losing work.
- G2. An author can keep a structured reference library and see it beside the manuscript while writing.
- G3. An author can publish a library and other authors can find it, read it and attach it to their projects.
- G4. Claude can rewrite a selected passage on request, and the author accepts or rejects the result as a diff.
- G5. Claude can review the structure of a chapter (pacing, scene turns, plants and payoffs, arcs) and return findings anchored to scenes that the author can work through.
- G6. Claude cost per user is metered and capped.

### Non-goals (v1)
- Real-time co-editing of one manuscript by several authors (single author per project).
- A free-form chat with Claude about the book, and retrieval (RAG) over the libraries. Planned after v1.
- Continuity / fact-checking against libraries. Planned after v1.
- Claude generating whole scenes or chapters unprompted; autocomplete-as-you-type.
- Publishing manuscripts (only libraries are public), e-book formatting, print layout.
- Native mobile or desktop apps; offline mode.
- Payments and subscription plans (usage caps are configured by the operator).

## 3. Personas & use cases

- **Author** (primary): writes one or more books. Wants a calm editor, their notes within reach, and targeted help from Claude on passages and structure.
- **Worldbuilder**: an author (often the same person) who maintains a detailed setting and publishes it as a public library for readers or collaborators.
- **Borrower**: an author writing in someone else's world (fan fiction, shared anthology) who attaches a public library to their project.
- **Operator / admin**: runs the instance; sets Claude usage caps, hides reported public content, reads logs.

## 4. User stories

Grouped by capability. IDs are referenced by milestones and, later, by epics.

**Accounts**
- US-1. As an author, I want to sign up and sign in with email (magic link) or Google, so that my work is tied to me.
- US-2. As an author, I want to set a display name and delete my account and all its data.

**Manuscript**
- US-3. As an author, I want to create projects (one book each) with chapters and scenes, and reorder them by dragging, so that the structure follows my outline.
- US-4. As an author, I want a distraction-light rich-text editor with headings, emphasis, scene breaks and comments-to-self, so that I can draft comfortably.
- US-5. As an author, I want my text saved automatically and to see "saved" status, so that I never lose work.
- US-6. As an author, I want to see word counts per scene, chapter and book, and a target for the book.
- US-7. As an author, I want to browse earlier versions of a scene and restore one.

**Reference libraries**
- US-8. As an author, I want to create library entries of type character, place, item, faction, event, note or source, with a title, rich-text body, tags and custom fields.
- US-9. As an author, I want to search and filter my libraries and open an entry in a side panel while writing.
- US-10. As an author, I want to attach one or more libraries to a project.
- US-11. As a worldbuilder, I want to publish a library (with a title, description and licence note) and unpublish it later.
- US-12. As a borrower, I want to browse and search public libraries, read their entries, and attach one to my project read-only or copy it into a private library I can edit.
- US-13. As any user, I want to report a public library; as an operator I want to hide reported libraries.

**Claude: inline edit**
- US-14. As an author, I want to select text and pick an action (rewrite, tighten, expand, change tone, fix grammar, or a custom instruction), so that I get a focused suggestion.
- US-15. As an author, I want the suggestion to stream in and appear as a diff against my text, and to accept, reject, or retry it.
- US-16. As an author, I want Claude to follow my project's style sheet (POV, tense, voice notes) and nearby text.

**Claude: structure review**
- US-17. As an author, I want to request a structure review of a chapter and get findings (pacing, scene turn, plant without payoff, payoff without plant, arc movement, POV slips) each tied to a scene, with an explanation and a suggestion.
- US-18. As an author, I want reviews saved so that I can mark findings resolved or dismissed and re-run the review after revising.
- US-19. As an author, I want the review to take my attached libraries into account (who characters are, what was planted earlier in the book).

**Usage**
- US-20. As an author, I want to see how much of my monthly Claude allowance I have used.
- US-21. As an operator, I want to set a per-user monthly token cap and see usage per user.

**Import / export**
- US-22. As an author, I want to import a manuscript from .docx or Markdown, split into chapters by heading.
- US-23. As an author, I want to export a project to .docx and Markdown, and a library to Markdown.

## 5. Functional requirements

**Accounts & access**
- FR-1. Sign-in by email magic link and Google OAuth; sessions persist 30 days.
- FR-2. Every project, manuscript node, library and review belongs to exactly one user; only the owner can read or write it, except published libraries (FR-17).
- FR-3. Account deletion removes all the user's data within 24 h and unpublishes their libraries.

**Manuscript**
- FR-4. A project contains an ordered list of chapters; a chapter contains an ordered list of scenes. Nodes can be created, renamed, reordered (also across chapters) and deleted (soft delete, recoverable 30 days).
- FR-5. Scene text is edited in a rich-text editor supporting paragraphs, headings, bold/italic, scene-break marker, block quotes, and inline author notes that are excluded from word counts, export and Claude prompts unless included explicitly.
- FR-6. Edits autosave within 2 s of the last keystroke; the UI shows saving/saved/error. A failed save is retried and never silently dropped.
- FR-7. Concurrent edits of the same scene from two tabs are detected (version check) and the second writer is asked to reload or overwrite.
- FR-8. Word counts are shown per scene, chapter and project; a project has an optional word-count target.
- FR-9. A scene snapshot is stored at most every 10 minutes while editing and on demand ("save version"); snapshots can be listed, previewed and restored.
- FR-10. Each project has a style sheet (POV, tense, voice/style notes, free text) used by Claude features.

**Libraries**
- FR-11. A library contains entries; an entry has a type (character, place, item, faction, event, note, source), title, aliases, rich-text body, tags and key/value custom fields.
- FR-12. Full-text search over the user's libraries and attached libraries, filterable by type and tag.
- FR-13. A project can attach any number of libraries (own or public); attached entries are viewable in the editor side panel.
- FR-14. Typing an entry title or alias in the editor can be turned into a link to the entry (manual, via a mention menu).

**Public libraries**
- FR-15. An owner can publish a library with title, description, cover image (optional) and licence text; publishing makes all its entries readable by any signed-in user.
- FR-16. Unpublishing removes it from browse and search; live attachments in other users' projects become unavailable and those borrowers are notified in the app. Copy-to-private (FR-18) is the way to keep a library permanently.
- FR-17. Public libraries are browsable and searchable by title, description, tags and author; a public library page lists its entries.
- FR-18. A borrower can attach a public library (live, read-only) or copy it into a new private library they own.
- FR-19. Any user can report a public library with a reason; an admin can hide or restore it; hidden libraries behave as unpublished for everyone but the owner.

**Claude: inline edit**
- FR-20. With a text selection of 1–4,000 words, the author can run: rewrite, tighten, expand, change tone (with a tone picker), fix grammar & spelling, or a custom instruction.
- FR-21. The request includes the selection, up to ~2,000 words of surrounding text, the style sheet and the action; it never includes other users' data.
- FR-22. The response streams into a suggestion view showing a word-level diff; the author can accept (replaces the selection, one undo step), reject, or retry (optionally with an extra instruction).
- FR-23. Accepting a suggestion is recorded in the scene's history with an "AI-assisted" marker.

**Claude: structure review**
- FR-24. The author can request a review of one chapter. Input: the chapter's scenes, a summary or full text of earlier chapters (whichever fits the budget), the style sheet, and the attached library entries referenced in the chapter.
- FR-25. The review returns structured findings: category (pacing, scene-turn, plant-without-payoff, payoff-without-plant, arc, pov/tense, clarity, other), severity (note, suggestion, issue), the scene it applies to, an optional quoted passage, an explanation and a suggestion.
- FR-26. Reviews run asynchronously; the UI shows progress and the author can keep writing. A finished review is stored with the manuscript version it was run on.
- FR-27. Findings can be marked resolved or dismissed; clicking a finding with a quote scrolls to and highlights that passage (if it still exists).
- FR-28. Re-running a review on a revised chapter creates a new review; the previous one stays readable.

**Usage & limits**
- FR-29. Every Claude call records user, feature, model, input/output/cache tokens and cost estimate.
- FR-30. Each user has a monthly token allowance (operator-configured default, per-user override). Requests that would exceed it are refused with a clear message; an in-flight request is never cut off.
- FR-31. Users see their usage this month; admins see usage per user.

**Import / export**
- FR-32. Import .docx and Markdown: Heading 1 → chapter, scene breaks (`***`, `#`, Heading 2) → scenes; preview before committing.
- FR-33. Export a project to .docx and Markdown (author notes excluded); export a library to Markdown (one file per entry, zipped).

**Admin**
- FR-34. Admin role (set via config) can view reported libraries, hide/restore them, set usage caps and view usage.

## 6. Non-functional requirements

- NFR-1. Performance: editor keystroke latency unaffected by autosave; a 200k-word project opens its outline in < 1 s and a scene in < 500 ms (p95, server in same region).
- NFR-2. Claude latency: inline edit shows first tokens in < 3 s p95; a chapter review of ≤ 10k words completes in < 2 min p95.
- NFR-3. Durability: no acknowledged save is lost; daily database backups with 7-day point-in-time recovery.
- NFR-4. Security: OWASP Top 10 baseline; all data access goes through ownership checks in the server layer (no client-trusted ids); CSRF protection; secrets only in env; rate limiting on auth and Claude endpoints.
- NFR-5. Privacy: manuscripts and private libraries are never shown to other users or used in another user's prompts; the Claude API is used under commercial terms (no training on inputs) and this is stated in the privacy note; users can export and delete their data.
- NFR-6. Accessibility: WCAG 2.2 AA for core flows (sign-in, outline, editor, library panel, suggestion diff, review list); full keyboard use of the editor and outline.
- NFR-7. Browser support: current Chrome, Firefox, Safari, Edge on desktop; read-only usable on tablets.
- NFR-8. Cost: average Claude cost per active author per month is visible to the operator and bounded by FR-30.
- NFR-9. Reliability: Claude errors, timeouts and refusals produce a clear, retryable message and never corrupt the manuscript.

## 7. System architecture (summary)

A single Next.js (App Router, TypeScript) application serves UI and API, backed by PostgreSQL. Claude is called server-side through the Anthropic TypeScript SDK; chapter reviews run as background jobs in a worker process using a Postgres-backed job queue. Deployed as a Docker image (web + worker roles) with managed Postgres. Full detail, diagrams and conventions: [ARCHITECTURE.md](ARCHITECTURE.md).

## 8. Data & storage

Core entities (detail in ARCHITECTURE.md §5): `user`, `project` (+ style sheet), `chapter`, `scene` (ProseMirror JSON + plain text + word count + version), `scene_snapshot`, `library`, `library_entry`, `project_library` (attachment), `library_report`, `review`, `review_finding`, `ai_usage`, `job`. Images (library covers) go to S3-compatible object storage.

## 9. API surface

No public API in v1. The browser talks to the app through Next.js server actions and a small set of route handlers for streaming (inline edit, SSE) and job status. All handlers validate input with Zod and enforce ownership server-side.

## 10. Environments & deployment

- **Local**: `docker compose up` for Postgres (+ MinIO for object storage); `npm run dev` for web, `npm run worker` for the job worker; `.env.local` from `.env.example`.
- **CI**: GitHub Actions — lint, typecheck, unit + integration tests (Postgres service container), Playwright e2e against a production build with Claude mocked.
- **Staging / production**: same Docker image, two process roles (web, worker), managed Postgres, S3-compatible storage. Secrets (`ANTHROPIC_API_KEY`, `AUTH_SECRET`, OAuth credentials, DB URL) in the host's secret store. Migrations run as a release step.

## 11. Observability expectations

- Structured JSON logs (pino) with a request id on every line; one log line per request (method, route, status, duration, user id) and per Claude call (feature, model, tokens, duration, stop reason, request id from Anthropic).
- Save failures, version conflicts, Claude errors/refusals and job failures logged at `warn`/`error` with ids, never swallowed.
- `/api/health` reports app version and database reachability.
- No manuscript or library text in logs at `info` or above (privacy); `debug` may log sizes and ids only.

## 12. Testing strategy

- **Unit** (Vitest): domain logic — outline reordering, word counts, diffing, prompt assembly, finding anchoring, quota maths.
- **Integration** (Vitest + real Postgres): server actions and route handlers with ownership checks; Claude client replaced by a recorded-fixture fake.
- **E2E** (Playwright): sign-in (test auth provider), write + autosave + reload, outline reorder, library side panel, publish/attach, inline edit accept/reject, review run and resolve — all with Claude mocked.
- **Claude quality**: a small eval set of passages and chapters per feature, run manually before changing prompts or models (not in CI; costs money).
- UI interactive checks during development use Playwright (and Claude in Chrome for exploratory checks).

## 13. Dependencies, models, licensing

- Next.js, React, TipTap (ProseMirror), Drizzle ORM, PostgreSQL, Auth.js, Zod, pino, pg-boss (job queue), Vitest, Playwright, mammoth (docx import), docx (export). All MIT/Apache-compatible; TipTap open-source core only.
- Claude via `@anthropic-ai/sdk`. Default model `claude-opus-5-5` for both features (inline edit at low effort for speed, review at high effort). Model and effort per feature are configuration, so the operator can trade cost against quality without a code change.
- Public library content is licensed by its author under the licence text they set; storyforge's terms grant only the right to display it.

## 14. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Claude cost grows with long manuscripts (reviews send whole chapters plus context) | Per-user monthly caps (FR-30), prompt caching of the stable book prefix, summaries of earlier chapters instead of full text, usage dashboard |
| Authors distrust AI touching their text | Claude acts only on explicit request, every change is a reviewable diff, AI-assisted edits are marked in history, privacy note on data use |
| Autosave loses work (network drop, two tabs) | Version check per scene, retry queue in the client, snapshots, e2e tests for offline-then-reconnect |
| Public library abuse (copyrighted or harmful content) | Report + admin hide (FR-19), licence field, terms of use; no anonymous browsing |
| Borrower loses an attached library when its owner unpublishes it | Warn on attach that live attachments can disappear; offer copy-to-private |
| Structure review findings anchor to text that has since changed | Store review against a manuscript version; anchor by quote and fall back to scene-level when the quote is gone |
| Claude refusals or outages | Server-side fallback models, clear retryable errors, features degrade without blocking writing |

## 15. Milestones

Each milestone becomes one epic and one OpenSpec change. M0 is always scaffolding.

| # | Milestone | Covers | Acceptance |
|---|-----------|--------|------------|
| M0 | Scaffolding & environment | Repo layout, Next.js + TS, Postgres + Drizzle migrations, docker compose, pino logging baseline + request id, Vitest + Playwright harness, CI, Dockerfile, `/api/health` | `docker compose up && npm run dev` serves the app; `/api/health` returns version + db ok; CI green; logs carry request ids |
| M1 | Accounts & auth | US-1, US-2; FR-1–3 | Sign in by magic link and Google; ownership helper used by every data access; account deletion works |
| M2 | Projects & outline | US-3, US-6 (counts structure); FR-4, FR-8 | Create project, chapters, scenes; drag to reorder; soft delete and restore |
| M3 | Manuscript editor | US-4–7; FR-5–7, FR-9–10 | TipTap editor with autosave, conflict detection, word counts, snapshots, style sheet |
| M4 | Private reference libraries | US-8–10; FR-11–14 | Libraries and entries CRUD, search, attach to project, side panel, mention links |
| M5 | Claude inline edit + usage metering | US-14–16, US-20 (view); FR-20–23, FR-29, FR-31 (user view) | Selection actions stream a diff; accept/reject/retry; every call metered |
| M6 | Public libraries | US-11–13; FR-15–19, FR-34 (moderation) | Publish/unpublish, browse/search, attach live or copy, report and admin hide |
| M7 | Claude structure review | US-17–19; FR-24–28 | Background chapter review with structured, anchored findings; resolve/dismiss; re-run |
| M8 | Usage caps & admin | US-21; FR-30, FR-31 (admin), FR-34 (caps) | Monthly caps enforced, admin usage view and per-user overrides |
| M9 | Import & export | US-22–23; FR-32–33 | .docx/Markdown import with preview; .docx/Markdown export; library export |

## 16. Open questions & assumptions

- A1 (assumption). Claude usage is paid by the operator's API key with per-user caps; no bring-your-own-key in v1.
- A2 (assumption). One author per project; sharing a manuscript for feedback is out of scope.
- A3 (assumption). Public libraries are visible to signed-in users only, not to the open web.
- A4 (assumption). Markdown and .docx are the only import/export formats in v1.
- Q1. Should a borrower who attaches a live public library be notified when it changes, or only when it disappears?
- Q2. Should the structure review also offer a whole-book mode in v1 (much higher cost), or chapters only?
