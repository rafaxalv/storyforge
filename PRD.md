# storyforge — Product Requirements

Status: draft v2 for review · 2026-11-17 · v1 (generic writing desk) superseded the same day after reviewing cowriter

## 1. Overview & vision

storyforge is the hosted successor to **cowriter** (`rafaxalv/cowriter`): the book skills plus the Manuscript Desk, rebuilt as one web application with a real database. Cowriter proved the method: a book moves from **Concept → Chapters (plan of record) → Scenes (scene cards) → Drafts → Manuscript**, written in **voices** defined on a fixed 31-dimension style framework, checked by a chain of reviews, in more than one language. What cowriter lacks is a single home for the data: the Desk keeps its own copy of the book and syncs it to the repo through export/sync scripts and commits, which costs effort and has lost edits.

storyforge keeps cowriter's concepts and vocabulary, stores every book object as data the app owns, and runs the Claude-powered steps (scene building, drafting, rewriting to a voice, reviews) as server-side features with the same rules the skills follow today: **show the change, the author approves, then it is applied**.

Two kinds of library exist, as in cowriter:
- **Private library**: everything one book keeps beside its text: research (with truth labels), sources, the Character Bible with its Continuity record, scenarios (places by period), the Bilingual Lexicon.
- **Public library**: the curated shared collection of **public-domain reference books** with their **style studies** and **texture profiles**, used by every book to build voices. Curated by the operator, read by all users.

## 2. Goals / non-goals

### Goals (v1)
- G1. An author can hold a whole book in storyforge (profile, concept, plan, scene cards, library, voices, drafts, manuscript) in every language of the book, without export/sync steps and without losing edits.
- G2. An existing cowriter book (e.g. `books/grandgrandfather/`) can be imported faithfully, and exported back to the cowriter folder layout, so nothing is locked in.
- G3. Voices work as in cowriter: 31 scored dimensions with base and range, rules, language layers, texture targets; a voice lab that blends reference authors from the public library; one voice and one tuning per chapter.
- G4. Claude, on request, scores a chapter's Readiness, builds scene cards from the plan, writes a chapter draft from the cards in the chapter's voice and languages, rewrites paragraphs to a chapter's tuning, edits a selection, and reviews a draft (sense and flow, chapter prose review with paragraph review, narrative review, texture report).
- G5. Nothing Claude produces changes the book until the author accepts it, and every accepted change is traceable.
- G6. Claude cost per user is metered and capped.

### Non-goals (v1)
- Several people writing one book (co-author accounts, real-time co-editing). One author per book; the import keeps "whose wording leads" information as data for later.
- Engagement heatmap, the Claude chat panel, read-aloud and voice chat (after v1).
- Web research by Claude (chapter-plan revision with web search, library-builder downloading books, author search). Authors and the operator add sources and books themselves in v1.
- Claude-assisted world-building scenarios, character speech-voice design and book translation as separate tools (data for all three is stored and editable; drafting and rewriting already write each language natively).
- The book knowledge graph (graphify).
- PDF typesetting (book-pdf); export is Markdown (cowriter layout) and .docx.
- User-published libraries shared between authors.
- Native apps, offline mode, payments.

## 3. Personas

- **Author** (primary; Rafael is the first): plans, writes and decides everything; works in English and reads/approves Portuguese; uses Claude for structured, approval-gated help.
- **Operator / admin**: runs the instance; curates the public library (adds public-domain books, style studies, texture profiles); sets Claude usage caps; reads logs.
- Future: **co-author** (writes one language; their wording is the source) — not a v1 account role.

## 4. Core concepts (the cowriter model, as storyforge data)

| Concept | In cowriter | In storyforge |
|---|---|---|
| Book profile | `BOOK.md` | Book settings: title, one-liner, shape (parts), length target, languages (code, name, written-first flag), standing rules, truth labels, people notes, formats (paragraph-ID scheme) |
| Concept | `outline/concept.md` | Rich-text document per book (with handle-with-care notes) |
| Chapters (plan of record) | `outline/chapters/NN-*.md` | Per chapter: title per language, part, When / where, Readiness line, ordered items: **Stories** (numbered events, "How the chapter runs" first), **Facts** (truth label, to-verify flag, cited sources), **Notes** (incl. *For the writer*), **Sources** (S1, S2… linking to research documents) |
| Scenes | `outline/scenes.md` scene cards | Scene cards per chapter: number + title, Covers (plan items and beats), When, Where, Scenario, POV, Characters (with speech voice ids), Shape (19, 20, 27–30 values + opening/ending/transition things), Slow down, Reader feeling, Texture note, Note |
| Voices | `voices/` | Voice: id (`NARR-`, `AUTHOR-`, `BASE-`, `CHAR-…-SPEECH`, `DOC-`), name, type, tags, version, status, 31 dimensions (base/min/max/note), rules (voice, conveying-feeling, narrative technique, scene architecture), texture (blend, caps, guidance), one language layer per language (references, offsets, vocabulary, phrase-building, address, literacy markers, language rules, texture targets, reference paragraph), change log |
| Chapter writing style | `config/chapter-writing-styles.csv` + `voices/<ID>/chapters/chapter-NN.md` | Per chapter: the voice in use; per voice: tuning (dimension offsets), reason, status (`to settle`/`settled`), texture overrides |
| Author Library | `voices/00-author-library.md` | Per book: reference authors with 31 scores, reasons, portrait, link to the public style study |
| Drafts | `voices/<ID>/drafts/chapter-NN.<lang>[.first].md` | Per chapter, per narrator voice: a first text and a revised text, paragraphs with ids, per language, scene markers, footnotes |
| Manuscript | `book/manuscript.<lang>.md` | The approved text: paragraphs with ids shared across languages, parts/chapters, footnotes; promoted from an approved draft |
| Paragraph parameters | `config/paragraph-parameters.csv` | Per paragraph: voice (when its own), voice version, review status, last reviewed, open issues |
| Character Bible + Continuity | `characters/` | Characters (by stage, group, speech voice), Continuity facts (per character, places, objects, dates, money, open threads) each linked to paragraph ids |
| Research | `research/` | Documents (Markdown, PDF, images) in folders, with truth labels; cited by plan sources |
| Scenarios | `scenarios/` | Places by period with spots, anachronism traps, "established in the text", colour script |
| Bilingual Lexicon | `voices/00-bilingual-lexicon.md` | Terms, per-language reader notes; footnote texts copied from it |
| Public library | `library/<author>/` | Curated public-domain texts, `STYLE.md` style studies, `TEXTURE.md` texture profiles |

## 5. User stories

**Accounts**
- US-1. As an author, I want to sign in with an email magic link or Google so that my books are mine.
- US-2. As an author, I want to delete my account and all my data.

**Book, concept and plan**
- US-3. As an author, I want to create a book with its profile (languages and which is written first, parts, length target, standing rules, truth labels, paragraph-ID scheme), so that every tool follows it.
- US-4. As an author, I want to write the Concept and see it beside the plan.
- US-5. As an author, I want to organise chapters into parts and keep each chapter's plan (When / where, Stories, Facts, Notes, Sources) as editable items, with facts labelled and linked to sources and sources linked to research, so that the plan is my plan of record.
- US-6. As an author, I want to see what is left to organise in a chapter (facts without source or label, items to verify, sources nobody cites).

**Scene cards**
- US-7. As an author, I want scene cards per chapter with the cowriter card fields and the six scene parameters, editable and reorderable, so that each chapter's cut and shape is recorded.
- US-8. As an author, I want Claude to build a chapter's scene cards from its plan (automatically, or as a proposal I adjust), with the review report (story lines covered/thin/missing, checks, open proposals), and to apply approved plan changes back to the chapter.

**Library (private)**
- US-9. As an author, I want research documents (Markdown, PDF, images) in folders with truth labels, cited by plan sources.
- US-10. As an author, I want a Character Bible (characters by stage and group, each with a speech voice) and a Continuity record linked to paragraph ids.
- US-11. As an author, I want scenarios (places by period, with spots and anachronism traps) linked from scene cards, and a Bilingual Lexicon whose notes become footnotes.

**Voices**
- US-12. As an author, I want to create and edit voices on the fixed 31-dimension framework (base, range, notes), with rules, texture and one language layer per language, and see their version history.
- US-13. As an author, I want a voice lab: pick reference authors from the public library with weights, blend their scores into a starting profile, adjust, and ask Claude for test paragraphs from a chapter's plan in that voice, in one or both languages; tests are kept and can be compared side by side.
- US-14. As an author, I want to set a chapter's writing style (the voice in use and that voice's tuning with a reason), with sliders limited to the voice's range and explicit reasons for anything outside.

**Public library**
- US-15. As an operator, I want to add public-domain books (text with source and translator), style studies and texture profiles per author.
- US-16. As an author, I want to browse the public library, read an author's style study and texture profile, and add the author to my book's Author Library.

**Drafts and manuscript**
- US-17. As an author, I want to edit a chapter's draft paragraph by paragraph, in one language or side by side, with paragraph ids, scene separators (foldable), "Add below", "Remove/restore", and review status per paragraph.
- US-18. As an author, I want drafts kept per narrator voice, each with its first text and revised text, so that I can switch a chapter's voice without losing either.
- US-19. As an author, I want autosave that never loses an edit, conflict detection across tabs, and versions I can restore.
- US-20. As an author, I want to promote an approved draft chapter into the manuscript and read the manuscript as a book (pages, footnotes as symbols restarting per page, scene breaks, font and size).
- US-21. As an author, I want footnotes (`[^key]`) for lexicon terms, with the note text taken from the Lexicon in each language.

**Claude assistance**
- US-22. As an author, I want Claude to score a chapter's Readiness with the six-parameter rubric (beats, arc, links, facts, decisions, voice) and explain the weakest parameters.
- US-23. As an author, I want Claude to write a chapter draft from its scene cards, in the chapter's voice and tuning, natively in every language of the book, into the voice's draft as a new first text.
- US-24. As an author, I want to select text and ask Claude to rewrite, tighten, expand, change tone, fix grammar or follow a custom instruction, and accept or reject the result as a diff.
- US-25. As an author, I want "Apply to chapter" / "Apply to paragraph": Claude rewrites paragraphs written before the current tuning to hit the chapter's targets, in every language, with what changed and what to check, and Undo per paragraph.
- US-26. As an author, I want a sense-and-flow review of a draft (out of order, does not make sense, gaps, repeats, stray paragraphs), each finding with the smallest fix, which I accept or reject.
- US-27. As an author, I want a chapter prose review: the draft against its scene cards, scenarios, continuity, rules, dialogue voices, voice coherence, languages, rhythm, the texture report and a narrative review (turns, tempo, leaps, plants and payoffs, motifs), with paragraph-level suggestions and proposed Continuity facts.
- US-28. As an author, I want a texture check of a chapter's narration against its voice's targets as moved by the chapter's tuning, and pattern-cap counts.

**Import / export**
- US-29. As an author, I want to import a cowriter book folder (from a zip or the GitHub repo) and see a report of what was imported, what was skipped and why.
- US-30. As an author, I want to export a book to the cowriter folder layout and a chapter or the manuscript to .docx.

**Usage**
- US-31. As an author, I want to see my Claude usage this month; as an operator, I want per-user monthly caps and a usage page.

## 6. Functional requirements

**Accounts & access**
- FR-1. Sign-in by email magic link and Google OAuth; sessions last 30 days.
- FR-2. Each book and everything in it belongs to one user; only that user can read or write it. Public library content is readable by all signed-in users and writable only by admins.
- FR-3. Account deletion removes all the user's data within 24 h.

**Book profile, concept, structure**
- FR-4. A book has a profile: title, one-liner, length target and hard limit (words), languages (code, display name, written-first flag), parts, standing rules (numbered, rich text, dated), truth labels (ordered list), people notes, paragraph-ID scheme (chapter.row with three digits; prologue `00`, epilogue `99`, interlude `INT`; letter suffixes for insertions).
- FR-5. A book has a Concept document (rich text).
- FR-6. Chapters belong to parts, have an id (as in the ID scheme), a title per language, and an order; reorder never renumbers paragraph ids.

**Chapter plan**
- FR-7. A chapter plan has When / where, a Readiness line (score, six parameter scores, date), and ordered items of kind event, fact, note or source. Events are numbered (`3.`, `3.2`) with "How the chapter runs" first; facts carry a truth label, a to-verify flag and cited source ids; sources are numbered S1… per chapter and may link to a research document; notes include *For the writer*.
- FR-8. Items can be added, edited, reordered and removed (removed items recoverable until purged); every change records who/what made it (author or a Claude feature) and when.
- FR-9. A chapter panel lists what is left to organise: facts with no source or no label, items to verify, sources nobody cites.

**Scene cards**
- FR-10. A chapter has ordered scene cards with: number (`N.k`), title (≤ 6 words), Covers (plan item refs with start/end beats), When, Where, Scenario ref, POV, Characters (character refs with speech voice ids, or unnamed roles), Shape (19, 20, 27, 28, 29, 30 values plus the named opening thing, ending thing and transition), Slow down, Reader feeling, Texture note, Note.
- FR-11. Scene parameter values outside the chapter voice's range require a reason; the card editor enforces it.

**Private library**
- FR-12. Research documents (Markdown edited in-app; PDF and images uploaded) in folders, each with an optional truth label, linked from plan sources; a document view lists the chapters that cite it.
- FR-13. Characters with name(s) by stage, group, short bullets, chapter pointers and speech voice; minor characters can share a group entry.
- FR-14. Continuity facts with a category (character, place, object, date, money, open thread), text and paragraph-id references; added only by author approval (directly or from a review).
- FR-15. Scenarios: place, period, spots, anachronism traps, established-in-text details; a colour script per book.
- FR-16. Bilingual Lexicon entries: key (ASCII), term per language, reader note per language; footnote markers `[^key]` in drafts resolve to the lexicon note of the paragraph's language.

**Voices & chapter writing styles**
- FR-17. Voices follow the fixed framework: tags (narrative person, addressed to, form, literacy, language) and the 31 dimensions in groups A–G, each with base (1–5), min, max and note. The framework is fixed in code; it is not editable per book.
- FR-18. A voice has rule sets (voice rules; conveying-feeling; narrative technique; scene architecture), each rule with why, do and don't; a Texture section (blend of model authors with weights, pattern caps, writer guidance); and one language layer per book language (reference authors with weights, offsets of at most ±1 on dimensions 4, 5, 6, 7, 11 with reasons, vocabulary strategy, phrase-building strategies, address and dialogue, literacy markers, language rules, texture targets table, reference paragraph).
- FR-19. Voices are versioned; saving a changed voice creates a new version with a change-log line; paragraphs record the voice version they were written or rewritten with.
- FR-20. Per chapter: the voice in use, and for each narrator voice its tuning (offsets per dimension), reason, status (`to settle` | `settled`) and texture overrides; changing the voice in use keeps every voice's settings.
- FR-21. Tuning sliders stay inside the voice's range; values outside turn into an explicit override that requires a reason. Dimensions 19, 20, 27–30 are shown read-only at chapter level (they are set per scene card).
- FR-22. The voice lab: create (empty or copy), describe, choose reference authors with weights from the book's Author Library, **Blend** (base = weighted average, ranges base ±1), adjust, draft rules with Claude (proposal, then edit), and generate test paragraphs (chapter, language or both, count, optional moment). Tests are stored and comparable side by side; they never enter drafts.

**Public library**
- FR-23. Admins add authors and books: author name, books (title, year, language, translator, source, public-domain status incl. "BR only"), plain text; a style study (rich text, scores 1–31 with reasons) and a texture profile (measurement table) per author. An author in copyright may have a texture profile and scores but no text.
- FR-24. All signed-in users can browse, search and read the public library and add an author (with scores) to a book's Author Library.

**Drafts & manuscript**
- FR-25. Paragraphs have ids per the book's scheme, an order key, text per language, optional own voice, voice version, review status, open issues, last change info; scene markers place paragraphs in scenes; footnote markers inside text.
- FR-26. A chapter's draft exists per narrator voice, with versions *first text* and *revised text*; the revised text is what the author edits; "revised" marks paragraphs that differ from the first text.
- FR-27. Editing: select a paragraph, then edit; add below (next free id or letter suffix), remove (restorable), side-by-side languages, foldable scenes, scene review tick per scene and voice.
- FR-28. Autosave within 2 s; per-paragraph optimistic concurrency; a failed save is retried and never dropped; conflicts show both versions. Every save of a chapter draft can be restored from history (snapshots at most every 10 minutes plus manual).
- FR-29. Promote: an approved draft chapter replaces the chapter in the manuscript (per language), keeping paragraph ids; the previous manuscript text stays in history.
- FR-30. Reader view of the manuscript (or a draft): pages of fixed size, font and size selectors, page count, footnotes as *, †, ‡… restarting per page, scene breaks as a centred dash with the next paragraph unindented, no ids or controls.

**Claude features** (all: run on request, run as background jobs when long, show results as a proposal; the book changes only on accept; every accepted change is recorded with the feature that proposed it)
- FR-31. Readiness: scores the chapter's plan with the rubric (weights 25/20/10/15/15/15; voice capped at 2 and total at 79 if tuning is not settled) and writes the Readiness line on accept.
- FR-32. Scene builder: from a chapter's plan, voice and neighbours' cards, produces scene cards (automatic) or a proposed structure first (brainstorm, with per-scene questions); runs the review (story lines covered/thin/missing, mechanical checks, narrative review at card level); applies shape fixes itself; story changes and plan changes are listed as proposals the author accepts one by one. Refuses below Readiness 60 and asks questions on the weakest parameters between 60 and 79.
- FR-33. Drafting: writes a chapter from its scene cards and the plan items they cover, in the chapter's voice, tuning and texture, in every book language natively (written-first language first), with paragraph ids, scene markers and footnote markers; result becomes the voice's *first text* (and initial revised text) after accept.
- FR-34. Inline edit: selection of 1–4,000 words; actions rewrite, tighten, expand, change tone, fix grammar, custom; streamed suggestion shown as a diff; accept replaces as one undo step.
- FR-35. Apply to chapter / paragraph: rewrites paragraphs whose applied tuning differs from the chapter's, one by one, in every language, sending the chapter as context plus the briefs (voice rules and language notes, scene beats and Reader feeling, speech voices, standing rules, continuity); stop keeps paragraphs already done; each paragraph shows what changed, what to check, and Undo.
- FR-36. Sense-and-flow review: findings table (paragraph id, kind, words, fix, before/after) with fix kinds move, merge, cut, bridge, rewrite; accepted fixes applied in every language.
- FR-37. Chapter prose review: report with overview, chapter map vs scene cards, plot and continuity issues, voice coherence, texture report, narrative review, paragraph suggestions (from paragraph-level review), proposed Continuity facts; each item accept/reject; accepted paragraph changes update text and paragraph parameters together.
- FR-38. Texture check: deterministic measures of a chapter's narration per language (port of cowriter's `texture.py`: paragraph and sentence length and spread, sentence shapes and openings, fragments, adjectives/adverbs, word variety, named emotions, explanation words, "but"/"not", function-word profile distance, repetition, abstract nouns, five senses, period/local words vs the Lexicon, speech tags), compared with the voice's targets moved by the chapter tuning (`TUNING_SHIFTS`), plus pattern-cap counts. No Claude call.

**Import / export**
- FR-39. Import a cowriter book folder (zip upload or GitHub repo + path via the user's GitHub token): BOOK.md → profile (structured fields where parseable, the rest as notes), concept, chapters plan files, scenes, scenarios, characters + continuity, research (incl. PDFs/images), voices (files, index, chapter settings, author library, lexicon, shared rules), drafts, manuscript, paragraph parameters. A dry run shows counts, warnings and unparsed sections before committing. Paragraph ids are preserved.
- FR-40. Import the shared `library/` of a cowriter repo into the public library (admin only).
- FR-41. Export a book to the cowriter folder layout (zip) that round-trips through FR-39 without loss for supported fields; export a chapter or the manuscript per language to .docx.

**Usage & limits**
- FR-42. Every Claude call is recorded: user, book, feature, model, tokens (input/output/cache), cost estimate, Anthropic request id, outcome.
- FR-43. Per-user monthly token cap (default by config, per-user override); requests over the cap are refused before calling Claude; running jobs finish. Users see their usage; admins see all.

## 7. Non-functional requirements

- NFR-1. Performance: opening a chapter draft of 10k words in two languages < 1 s p95; outline and plan of a 30-chapter book < 1 s.
- NFR-2. Claude latency: inline edit first tokens < 3 s p95. Long features (readiness, scene builder, drafting, apply-to-chapter, reviews) run in the background with visible progress and can be cancelled; the author can keep working.
- NFR-3. Durability: no acknowledged save is lost; daily backups with point-in-time recovery; every Claude-applied change is undoable.
- NFR-4. Security: OWASP Top 10 baseline; ownership checks server-side on every access; secrets in env only; rate limits on auth and Claude endpoints; book text in prompts is delimited and treated as material, never instructions.
- NFR-5. Privacy: books are private; Claude used under commercial terms (no training on inputs); no book text in logs; full export and deletion available.
- NFR-6. Fidelity: the cowriter import + export round trip preserves every supported field byte-for-byte where the format allows (tested on the grandgrandfather book).
- NFR-7. Accessibility: WCAG 2.2 AA for core flows; full keyboard use of paragraph selection and editing.
- NFR-8. Internationalisation: the UI is English in v1; book content supports any language (UTF-8, per-language typography for quotes and dashes).
- NFR-9. Cost visibility: average Claude cost per book-chapter operation is visible to the operator; bounded by FR-43.

## 8. System architecture (summary)

One Next.js (App Router, TypeScript) application with a worker process, PostgreSQL, S3-compatible storage, and the Claude API via the Anthropic TypeScript SDK. Long Claude features run as jobs in the worker; prompts are assembled from the book's data by a **brief builder** (the equivalent of the Desk's context documents) with prompt caching on the stable book prefix. The texture measures are a deterministic TypeScript module. Detail: [ARCHITECTURE.md](ARCHITECTURE.md).

## 9. Data & storage

Relational model mirroring §4 (detail in ARCHITECTURE.md §5). Rich text stored as ProseMirror JSON plus derived plain text; paragraph text per language in its own rows so concurrency and history work per paragraph. Files (PDFs, images, public-library texts, import/export zips) in object storage.

## 10. API surface

No public API in v1. Server actions and route handlers (SSE for streaming and job progress); all inputs validated with Zod; ownership enforced in the domain layer.

## 11. Environments & deployment

- Local: docker compose (Postgres, MinIO), `npm run dev`, `npm run worker`; FakeClaude by default, real key opt-in.
- CI: GitHub Actions: lint, typecheck, unit + integration (Postgres), Playwright e2e against a production build with FakeClaude; the cowriter round-trip test on a fixture book.
- Staging / production: one Docker image with web and worker roles, managed Postgres, S3-compatible bucket, secrets in the host's store; migrations as a release step.

## 12. Observability expectations

Structured JSON logs (pino) with a request id (and job id) on every line; one line per request and per Claude call (feature, model, effort, tokens incl. cache, duration, stop reason, Anthropic request id); job start/progress/end/fail; save conflicts and failed saves; import/export reports logged by counts. Never log book text. `/api/health` with version and DB status.

## 13. Testing strategy

- Unit (Vitest): ID scheme, ordering, readiness maths, tuning ranges, texture measures (against cowriter's `texture.py` outputs on fixture texts), brief assembly, diffing, footnote resolution, importer parsers.
- Integration (Vitest + Postgres): domain modules and handlers incl. ownership; Claude via FakeClaude fixtures.
- E2E (Playwright): sign-in, import the fixture book, edit plan and cards, edit a draft side by side with autosave and reload, voice tuning, inline edit and apply-to-paragraph accept/undo, review accept, reader view — with FakeClaude.
- Round trip: import → export → diff on a fixture copy of a cowriter book.
- Claude quality: per-feature eval sets run manually before prompt or model changes (costs money; not in CI).

## 14. Dependencies, models, licensing

- Next.js, React, TipTap/ProseMirror, Drizzle, PostgreSQL, Auth.js, Zod, pino, pg-boss, Vitest, Playwright, a Markdown parser (remark/unified) for import/export, `docx` for .docx export.
- Claude via `@anthropic-ai/sdk`, default `claude-opus-5-5` for every feature; effort per feature (low for inline edit, high for drafting and reviews) and model per feature configurable by env.
- Public library texts are public domain (US and BR, or marked "BR only"); in-copyright authors are represented only by measurements and scores, never text.

## 15. Risks & mitigations

| Risk | Mitigation |
|---|---|
| cowriter formats are rich Markdown conventions, not strict schemas; import may misparse | Dry-run report with unparsed sections kept as notes; round-trip test on the real book; parsers driven by the documented formats in BOOK.md and the skills |
| The skills are long, evolving prompts; storyforge prompts drift from them | Each Claude feature names the skill section it implements; eval sets built from cowriter outputs; prompts versioned in the repo |
| Claude cost of drafting and chapter reviews (whole-chapter context + briefs, both languages) | Prompt caching of the book brief, per-feature effort, usage caps, cost shown before running long features |
| Losing edits (the Desk's real failure) | Server is the single copy; per-paragraph concurrency; retry queue; history; e2e tests for offline/reconnect |
| Texture port diverges from `texture.py` | Golden tests against `texture.py` outputs on the same texts |
| Scope: v1 is large | Epics ordered so the book can be imported and edited early (dogfooding), Claude features layered after |
| Two sources of truth during transition (repo and storyforge) | Export to cowriter layout; the author chooses one primary home per book; import shows what would be overwritten |

## 16. Milestones

Each milestone becomes one epic and one OpenSpec change. Library and voices come before the plan because scene cards reference scenarios, characters and voice ranges.

| # | Milestone | Covers | Acceptance |
|---|---|---|---|
| M0 | Scaffolding & environment | Next.js + TS, Postgres + Drizzle, compose, pino + request ids, worker, Vitest + Playwright, CI, Dockerfile, Claude seam + FakeClaude, `/api/health` | One-command local run; health endpoint; CI green; logs carry request ids |
| M1 | Accounts & auth | US-1–2; FR-1–3 | Sign-in, ownership helper, account deletion, admin role by config |
| M2 | Book profile & structure | US-3–4; FR-4–6 | Book with profile, languages, parts, chapters, Concept |
| M3 | Private library | US-9–11; FR-12–16 | Research docs and files, Character Bible + Continuity, scenarios, Lexicon |
| M4 | Voices & chapter writing styles | US-12, US-14; FR-17–21 | Voice editor on the framework, versions, language layers, chapter voice + tuning |
| M5 | Chapter plan & scene cards | US-5–7; FR-7–11 | Plan items with labels/sources, left-to-organise panel, scene cards editor with range checks |
| M6 | Drafts & manuscript editor | US-17–21; FR-25–30 | Paragraph editor, side by side, drafts per voice, autosave/conflicts/history, promote, reader view, footnotes |
| M7 | Cowriter import & export | US-29–30; FR-39–41; NFR-6 | grandgrandfather imports with a clean report; export round-trips; .docx export |
| M8 | Claude foundation, inline edit & usage metering | US-24, US-31 (user view); FR-34, FR-42 | ai.call wrapper, brief builder, job runner for Claude features, inline edit with diff, metering |
| M9 | Public library & voice lab | US-13, US-15–16; FR-22–24 | Curated authors/books/studies/profiles, Author Library, blend, Claude test paragraphs |
| M10 | Readiness & scene builder | US-8, US-22; FR-31–32 | Readiness scoring; scene cards built with review report and proposals |
| M11 | Drafting | US-23; FR-33 | Chapter draft from cards in voice, all languages, as a new first text |
| M12 | Texture measures & rewrite to voice | US-25, US-28; FR-35, FR-38 | Texture check with golden tests; apply to chapter/paragraph with undo |
| M13 | Prose review | US-26–27; FR-36–37 | Sense-and-flow and chapter prose review with accept/reject applying in all languages |
| M14 | Usage caps & admin | US-31 (admin); FR-43 | Caps enforced; admin usage page |

## 17. Assumptions & open questions

- A1. Claude usage is paid by the operator's key with per-user caps; no bring-your-own-key in v1.
- A2. One author per book in v1; "whose wording leads" per language/paragraph is imported and stored but not enforced by roles.
- A3. The public library is curated by admins only; users cannot publish libraries.
- A4. Claude features follow the cowriter skills' method as of 2026-11-17; later skill changes are ported deliberately, not automatically.
- A5. The 31-dimension framework is fixed in code for all books (as the skills require); changing it is a product change.
- A6. Web research, the heatmap, the chat panel, graph, PDF typesetting and translation tools are after v1.
- Q1. Once a book is imported, is storyforge its primary home (repo becomes an export target), or do both stay live for a while (needing a re-import that merges)?
- Q2. Should scene-review ticks, voice-lab tests and Desk chats from the Manuscript Desk store be imported too (they live in the Desk's artifact store, not the repo)?
