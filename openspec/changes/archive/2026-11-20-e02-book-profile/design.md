## Context

E01 left signed-in authors with nothing to own yet. The access layer is in place (`getActor`, `requireOwner`, `Forbidden` → 404, `requirePageActor()` for pages, the `twoUsers()` integration pattern in `tests/integration/access.test.ts`) and every app page sits under `src/app/(app)/`. All writes so far are server actions; `withActorResponse` exists for API routes but is unused. Pages have no styles beyond an inline font on `<body>`, which makes them unreadable in dark mode. ARCHITECTURE.md §3 (domain modules take `actor` first) and §8 (logging, no book text in logs) apply as written. This epic is the first to store author content, so its patterns (ownership check per book, rich-text storage, versioned autosave, ordered lists) are the ones E03–E07 copy.

## Goals / Non-Goals

**Goals:**
- One domain module `src/server/books/` that owns every read and write of books, languages, standing rules, truth labels, Concept, parts and chapters, each guarded by one book-ownership check.
- A rich-text storage format and editor that later epics reuse (library notes, scene cards, drafts build on it).
- A versioned autosave that never silently overwrites newer text.
- Ordered lists (languages, rules, labels, parts, chapters) with keyboard-operable moves and stable chapter codes.
- A small styling baseline with light and dark tokens.

**Non-Goals:**
- Paragraphs, paragraph ids and the drafts editor (E06); `id-scheme.ts` covers chapter codes now and grows paragraph ids in E06.
- Plan items and scene cards (E05); cowriter import/export (E07), though the storage choices below are made so E07 can map them.
- Co-authors, sharing, real-time collaboration.
- Drag-and-drop reordering (buttons only in v1; drag can be added on top later).

## Decisions

1. **Tables** (`src/server/db/schema/books.ts`, migration `0002_books`). Ids are `uuid` with `gen_random_uuid()`; timestamps `timestamptz`.
   - `book`: `id`, `owner_id` → `user.id` ON DELETE CASCADE, `title`, `one_liner`, `length_target`, `length_limit` (int, nullable), `people_notes` (text), `truth_labels` (jsonb string array), `id_scheme` (text, `'cowriter-v1'`), `version` (int), `created_at`, `updated_at`. Index on `(owner_id, updated_at desc)`.
   - `book_language`: `id`, `book_id` → cascade, `code`, `name`, `written_first` (bool), `position`. Unique `(book_id, code)`; partial unique index on `(book_id) WHERE written_first` so the database itself holds "at most one" (the "at least one" half is kept by the domain module, which never removes the written-first row and flips the flag in one transaction).
   - `standing_rule`: `id`, `book_id` → cascade, `body` (jsonb rich text), `position`, `created_at`, `updated_at`.
   - `concept`: `book_id` PK → cascade, `body` (jsonb rich text), `version`, `updated_at`. Created with the book.
   - `part`: `id`, `book_id` → cascade, `titles` (jsonb `{code: title}`), `position`, `removed_at`.
   - `chapter`: `id`, `book_id` → cascade, `part_id` → `part.id` ON DELETE SET NULL (parts are only soft-removed in practice), `code`, `titles` (jsonb), `position`, `removed_at`, `created_at`. Unique `(book_id, code)` across removed and active rows.
   - Truth labels are a jsonb array on `book` (always read and written as one ordered list of ≤ 20 short strings) rather than a table. Titles per language are a jsonb map rather than a `chapter_title` table: they are always read with their row, and removing a language is one `titles - 'PT-BR'` update per table.
   - Every table hangs off `book`, which hangs off `user`, so account deletion and book deletion remove everything by cascade. A `books` purge step is still registered (deletes any `book` rows of the user id; normally zero) so the purge registry names every data owner, as E01 asked of later epics.

2. **Ownership check, once per call.** `src/server/books/access.ts` exports `ownedBook(actor, bookId, op, tx?)`: validates `bookId` as a uuid (malformed → `NotFound`), selects `owner_id`, and throws `NotFound` when missing or `requireOwner`'s `Forbidden` when foreign. A new `NotFound` error joins `Unauthenticated`/`Forbidden` in `actor.ts` and maps the same as `Forbidden` (404 / "Not found"), so a foreign book and a missing one look identical. Child rows (part, chapter, rule, language) are always selected with `WHERE id = $child AND book_id = $book` after `ownedBook`, so a child id from another book is also "not found" (no IDOR through child ids).
   - Pages: `src/app/(app)/books/[bookId]/layout.tsx` calls `requirePageActor()` then `getBookHeader(actor, bookId)` and turns `NotFound`/`Forbidden` into `notFound()`.
   - Actions: one wrapper `bookAction(op, fn)` in `src/app/(app)/books/action.ts` resolves the actor, runs `fn`, and returns `{ error }` for `ZodError`, `BookValidationError`, `Conflict` and `NotFound`/`Forbidden` ("Not found."); anything else is rethrown (Next logs it via `onRequestError`).

3. **Rich text = ProseMirror JSON in `jsonb`, allowlisted on the server.** `src/shared/rich-text.ts` defines a recursive zod schema for the StarterKit subset the spec allows: `doc`, `paragraph`, `heading` (`level` 1–3), `bulletList`, `orderedList` (`start` int), `listItem`, `blockquote`, `horizontalRule`, `hardBreak`, `text`; marks `bold`, `italic`, `strike`. Unknown keys are stripped, unknown node/mark types fail, depth ≤ 20, text ≤ the per-field limit (Concept 200,000 chars, rule 10,000), serialized size ≤ 1 MB. The editor (`src/client/rich-text-editor.tsx`, TipTap with StarterKit configured to only those extensions: `link`, `code`, `codeBlock`, `underline` off) is the only renderer, read-only where needed; we never produce or inject HTML strings.
   - Alternatives: HTML (needs a sanitizer on every read and write; harder to diff), Markdown (simpler for cowriter but lossy round-trips through the editor and needs a Markdown extension). E07 adds a JSON ↔ Markdown mapper for exactly this node set.
   - **TipTap version:** ARCHITECTURE.md and the OpenSpec context say TipTap 2; v3 has been the stable line since 2025 and v2 is in maintenance, so this epic pins the current stable 3.x exactly (same reasoning as Better Auth over Auth.js beta) and updates both documents. `npm audit` clean. The editor is loaded with `next/dynamic` (`ssr: false`) only on pages that edit rich text, with `immediatelyRender: false`.

4. **Versioned saves.** `book.version` covers the profile form and the truth-label list; `concept.version` covers the Concept. Saves run `UPDATE … SET …, version = version + 1 WHERE id = $id AND version = $expected RETURNING version`; zero rows after a successful ownership check → `Conflict` (logged, returned to the form as "changed elsewhere, reload"). Languages, rules, parts and chapters are edited item by item through small actions; each is a single-row change, so last write wins per item and needs no version.

5. **Concept autosave.** Client debounce 1,000 ms after the last change; one save in flight at a time (later edits queue behind it with the newest content); status text `Saving…` / `Saved` / error. On `pagehide` or route change with unsaved changes, a final save is sent. A `Conflict` stops autosave, keeps the editor content on screen and shows "changed elsewhere, reload" with a "copy my text" button. Server action `saveConceptAction(bookId, body, version)` → `{ version } | { error }`.

6. **Concept side panel.** URL search param `?panel=concept` on any `/books/[bookId]/…` page. Because layouts don't receive search params, a client `ConceptPanel` in the book layout reads `useSearchParams()`, and when open loads the Concept with `loadConceptAction(bookId)` and mounts the same editor (same autosave and version). The toggle is a `<Link>` that adds or removes the param, so reload keeps it. CSS: two columns from 1,000 px wide; below that the panel is a full-height overlay with a close link and focus moved into it.

7. **Ordering.** Integer `position`, kept dense (0..n-1) per scope: languages per book, rules per book, parts per book, chapters per (book, part or no part). A move is one action `move(kind, id, direction | targetPartId)` that, inside a transaction, locks the book row (`SELECT … FOR UPDATE`) to serialize structure edits per book, swaps with the neighbour or appends to the target part, and renumbers the source scope. Lists are ≤ 200 rows, so renumbering is cheap. Fractional indexing was rejected as unnecessary at this size. Chapter codes are not touched by any move path, and there is no update path for `code` at all.
   - UI: each row has "Move up" / "Move down" buttons (and a part `<select>` + "Move" for chapters) rendered as `<form>`s with hidden inputs, so they work without JS; with JS a small client wrapper runs them in a transition and restores focus to the same button by id after the refresh. First/last buttons are `disabled`.

8. **Chapter codes** (`src/shared/id-scheme.ts`): `CHAPTER_CODE = /^(\d{2}|INT[1-9]?)$/` with `00` prologue and `99` epilogue labelled; `chapterKind(code)`, `suggestNextCode(existing)` (lowest unused `01`–`98`), and `ID_SCHEME_COWRITER_V1` with the examples the profile shows. Used by the server's zod schema and the form's `pattern`/hint so both say the same thing. Duplicate codes are caught by the unique index and returned as a field error.

9. **Removal and restore** (parts, chapters) set `removed_at`; restore clears it and appends at the end of the scope (a chapter whose part is removed is restored to "no part"). A part can be removed only with zero active chapters. Removed rows keep their codes reserved. Hard deletion happens only with the whole book.

10. **Languages.** Codes normalized to upper case and validated `^[A-Z]{2}(-[A-Z]{2})?$`. Changing written-first flips both rows in one transaction. Removing a language (never the written-first one) runs in one transaction: delete the row, strip that key from every `part.titles` and `chapter.titles` of the book, renumber. Title maps are validated on write: keys ⊆ the book's current codes, written-first title required (1–200), others 0–200.

11. **Limits** (checked inside the same transaction as the insert, after the book lock where one is taken): 100 books per owner, 10 languages, 100 rules, 20 truth labels, 30 parts, 200 chapters per book. Hitting one returns a form message and logs `book.limit`.

12. **Pages follow cowriter's Manuscript Desk** (`rafaxalv/cowriter`, `tools/manuscript-editor/index.html` and its README), the UI authors already use; storyforge is its hosted successor, so the book pages look and work "more or less" like it (author's request, 2026-11-20). All pages are server components under `src/app/(app)/`, forms are server actions with `useActionState` where feedback is needed.
    - **Top bar** (sticky, paper background, bottom rule): on book pages the book title in serif with a small "Your books" line under it, then the segmented tab group (Desk order; E02 has **Concept**, **Chapters**, **Profile**; later epics insert Research and Writing styles before Chapters, and Scenes, Draft and Book after it), then a Concept-panel toggle and the author's name, Settings and Sign out. Other pages show "storyforge" in the brand slot.
    - **Desk body:** a left panel (280–330 px, paper, sticky, own scroll, uppercase small heading) for the settings of what is selected, and the main area on the page background. Below 900 px the panel comes after the main content, as in the Desk.
    - **Chapters** (`/books/[bookId]`): main = parts as sections (serif heading, mono count) holding one **cell** per chapter: mono accent code (`03`), kind chip (Prologue, Epilogue, Interlude), serif written-first title, other-language titles under it, and ↑ ↓ / Remove in the cell head (like the Desk's scene boxes). Selecting a cell (`?sel=<chapterId>` or `?sel=part:<partId>`, a link, so keyboard and reload work) highlights it and puts its settings in the left panel: titles per language, part, move. With nothing selected the panel holds "Add a chapter" and "Add a part". Removed items show struck through and faded under "Removed", with Restore.
    - **Profile** (`/books/[bookId]/profile`): left panel = the section list to jump to; main = eyebrow "BOOK", serif h1, sections as Desk plan sections (serif h2, mono count, hint) with uppercase field labels; standing rules as numbered cells with their date chip and tools.
    - **Concept** (`/books/[bookId]/concept`): main = the Desk's document column (760 px, Spectral 16.5/1.65) with the editor borderless and a slim toolbar; left panel = the Concept's headings to jump to and the save status (the Desk's panel shows the open file's headings).
    - **Concept side panel:** on the right, like the Desk's Claude panel (paper, left rule, uppercase heading, › to close); it slides over the page below 900 px.
    - **Home** (`/`) and `/books/new`: the same bar and a single column of book cells / a form card.

13. **Styling: the Desk's design tokens.** `src/app/globals.css` (imported by the root layout) carries the Desk's tokens and component styles, adapted to plain CSS classes: `--bg #f3f4f7`, `--paper #fff`, `--ink #1d2230`, `--ink-2`, `--ink-3`, `--rule`, `--rule-2`, `--accent #2f45a8`, `--accent-soft`, `--warn`, `--warn-soft`, `--ok`, `--radius 6px`, with the Desk's dark set under `prefers-color-scheme: dark` (and `data-theme` overrides); fonts Spectral (text), Public Sans (UI), IBM Plex Mono (ids), self-hosted through `next/font/google` (downloaded at build time, no request to Google at runtime). Body 14 px Public Sans; component classes `.bar`, `.brand`, `.tabs`, `.desk`, `.panel`, `.p-head`, `.main`, `.field`, `.btn`, `.iconbtn`, `.cell`, `.c-head`, `.pid`, `.chip`, `.plan-sec`, `.doc`, `.notice`. Plain CSS, no Tailwind or component library; no inline colours. E01 pages pick up the tokens.

14. **Testing.**
    - Unit: `id-scheme` (valid/invalid codes, suggestion), rich-text schema (allowed doc passes; links, images, `code`, unknown attrs, oversize and deep docs fail), language code normalization, title-map validation, `bookAction` error mapping.
    - Integration (real Postgres, `twoUsers()`): every domain function with the owner and with the other user (→ not found, nothing changed), child-id-from-another-book cases, version conflicts, limits, concurrent moves, move/restore invariants (dense positions, codes unchanged), language removal stripping titles, book and account deletion cascade, log hygiene (no titles, rule text, Concept text or notes in captured logs).
    - E2E (Playwright): create book → profile edits → languages → rules → labels → outline with parts/chapters, keyboard moves, remove/restore → Concept autosave + reload → panel beside the outline → delete book; dark-mode readability via computed colours.

## Observability

- **Logger:** `storyforge:books` for everything in this epic; refusals keep using `storyforge:access` (`access.denied` with `op` like `books.updateProfile`).
- **Events** (info unless noted; every line has `requestId`, `userId`, `bookId`; **never** titles, one-liners, notes, rule or Concept text, or title maps):
  - `book.created` `{ languageCode }`; `book.deleted`; `book.delete.refused` (warn) `{ reason: "confirmation" }`.
  - `book.profile.updated` `{ fields: [names of changed fields], version }`; `book.conflict` (warn) `{ target: "profile" | "labels" | "concept", expected }`.
  - `book.language.added | updated | moved | removed` `{ code }`; `removed` adds `{ titlesStripped }`.
  - `book.rule.added | updated | moved | removed` `{ ruleId, chars }`.
  - `book.labels.updated` `{ count, reset }`.
  - `concept.saved` `{ version, chars, ms }`; `concept.rejected` (warn) `{ reason: "schema" | "size" }`.
  - `part.created | renamed | moved | removed | restored` `{ partId }`; `part.remove.refused` (warn) `{ partId, activeChapters }`.
  - `chapter.created | renamed | moved | removed | restored` `{ chapterId, code }` (codes are structure, not text); moves add `{ fromPartId, toPartId, position }`.
  - `book.limit` (warn) `{ kind, limit }`.
  - Purge: the `books` step reports through E01's `account.purge.step` `{ step: "books", deleted }`.
- **Correlation:** the E00 request id is on every line (server actions run inside the request context); the request's `request` line and the `books` lines share the same `requestId`.
- **Debug switch:** `LOG_LEVEL=debug` adds `books.action` entry lines `{ op }` and each domain call's duration (`ms`).
- **Redaction check:** the log-hygiene integration test writes sentinel strings into every text field and asserts none appears in the captured log.

## Security

Rule files in `.claude/rules/security/` that apply:

- **owasp-2025.md**
  - A01 Broken Access Control: `ownedBook()` on every domain call; child rows always scoped by `book_id`; 404 for missing and foreign alike; tests per action with `twoUsers()` including child-id swaps across books.
  - A02 Misconfiguration: no new env, routes or headers; generic "Not found" / validation messages only.
  - A03 Supply chain: TipTap packages exact-pinned, lockfile, `npm audit --omit=dev` clean; loaded only on editing pages.
  - A05 Injection: Drizzle parameterised queries; jsonb written as parameters; zod on every action input (ids as uuid, codes by regex, lengths, numbers as integers in range); rich text never rendered as HTML (XSS).
  - A06 Insecure design: per-owner and per-book limits; row lock to serialize structure edits; versioned saves to avoid lost updates.
  - A08 Integrity: rich-text JSON parsed against an allowlist schema before storage (no arbitrary nodes, attributes or marks); JSON only, no other deserialization.
  - A09 Logging: events with ids and counts, no book text; sentinel test.
  - A10 Exceptional conditions: conflicts and limit hits are explicit results, never silent overwrites; the autosave keeps unsaved text on screen on any failure.
- **typescript.md**: zod for every external input including the rich-text tree; no `as` on untrusted data; string-literal unions for kinds and directions.
- **react.md**: no `dangerouslySetInnerHTML`; TipTap configured without `link` (no `javascript:` URLs); pasted HTML is reduced to the allowed nodes by the editor schema, then re-validated on the server; server actions only (Next's origin check covers CSRF).
- **ai-security.md**: not applicable, no Claude calls in E02. Noted for E08: Concept and rules will go into prompts as delimited material.
- **docker.md / github-actions.md**: no changes beyond new dependencies in the image.

## Risks / Trade-offs

- [Autosave conflict loses typing] → the editor never discards text on conflict; "copy my text" and a reload message; conflict test in e2e.
- [TipTap bundle size and SSR quirks] → dynamic import on editing pages only, `immediatelyRender: false`; the outline and home pages ship no editor JS.
- [jsonb title maps drift from the language list] → keys validated on write; language removal strips keys in the same transaction; integration test.
- [Position races from two tabs] → book row lock per structure edit; positions re-densified on every move; concurrency test.
- [Rich-text schema too strict for E06 drafts] → the schema is a named node set (`CONCEPT_NODES`); later epics extend it deliberately, with tests.
- [Styling baseline changes E01 pages] → E01 e2e suite re-run; locators are ids, not styles.

## Migration Plan

New tables only (`0002_books`), no changes to E01 tables. Deploy: migrate, then start web and worker. Rollback: revert the merge and drop the six tables (loses books written since; acceptable before launch).

## Open Questions

None blocking. E07 will confirm the JSON ↔ Markdown mapping against real cowriter files; the node set above is the one cowriter's Markdown uses.
