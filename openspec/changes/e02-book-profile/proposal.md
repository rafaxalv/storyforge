## Epic

E02 - Book profile & structure (see [EPICS.md](../../../EPICS.md#e02--book-profile--structure))

## Why

Every later tool (library, voices, plan, drafts, Claude features, cowriter import/export) works inside a book and follows the book's profile: its languages, its standing rules, its truth labels and its paragraph-ID scheme. Before any of that can exist, an author needs to create a book, set its profile, lay out its parts and chapters, and write its Concept (PRD FR-4, FR-5, FR-6). This is also the first epic that stores an author's own content, so it sets the pattern for owned data: actor first, 404 for other users' books, nothing of the book's text in logs.

## What Changes

- Books: create, list (home page), open, delete (typed title confirmation). One owner per book.
- Book profile page: title, one-liner, length target and hard limit (words), languages (code, display name, one written-first language, ordered), standing rules (rich text, numbered by order, dated), truth labels (ordered list; cowriter defaults DOCUMENTED, STRONGLY SUPPORTED, FAMILY TRADITION, PLAUSIBLE RECONSTRUCTION, FICTIONAL), people notes, paragraph-ID scheme (shown; one scheme in v1, the cowriter one).
- Parts and chapters: create, rename (title per book language), reorder (keyboard-accessible up/down, move a chapter to another part), remove and restore. Chapter codes follow the scheme (`01`–`98`, `00` prologue, `99` epilogue, `INT`, `INT1`–`INT9`), are unique in the book, and never change on reorder.
- Book outline page: parts with their chapters in order, plus a "Removed" list with restore.
- Concept: one rich-text document per book with autosave and a conflict check; its own page and a side panel that opens beside any book page.
- Shared rich-text editor (TipTap, StarterKit nodes only) with server-side validation of the stored document.
- Styling baseline: colour tokens for light and dark mode, applied to every existing page (fixes unreadable text in dark mode).
- `src/shared/id-scheme.ts`: chapter-code rules shared by server and client (paragraph ids arrive in E06).
- New tables: `book`, `book_language`, `standing_rule`, `concept`, `part`, `chapter`. All rows cascade from `user`, so account deletion removes them.

## User Stories

- **US-1** As an author, I want to create a book and edit its profile (title, one-liner, length target and limit, languages with the written-first flag, standing rules, truth labels, people notes, paragraph-ID scheme), so that every tool follows it.
  - Acceptance: profile page with those fields; languages can be added/reordered; standing rules numbered and dated; default truth labels from cowriter (DOCUMENTED … FICTIONAL).
- **US-2** As an author, I want parts and chapters with ids from the scheme (`01`, `00` prologue, `99` epilogue, `INT`) and a title per language, so that the book's shape is set.
  - Acceptance: create, rename, reorder, remove (restorable); reordering never changes chapter ids; a book outline view.
- **US-3** As an author, I want to write the Concept and open it beside other pages.
  - Acceptance: rich-text Concept with autosave; side-panel view.

## Capabilities

### New Capabilities
- `book-profile`: creating, listing and deleting books; the book profile (fields, languages, standing rules, truth labels, people notes, ID scheme); the Concept document and its side panel; ownership of book data.
- `book-structure`: parts and chapters (codes, titles per language, order, removal and restore) and the book outline view.

### Modified Capabilities
_None._ Account deletion already removes all of a user's rows; this epic's tables join it through foreign-key cascade, which `account-management` covers as written.

## Impact

- New code: `src/server/books/` (domain module: books, languages, standing rules, concept, parts, chapters), `src/shared/id-scheme.ts`, `src/shared/rich-text.ts` (document schema and limits), `src/client/rich-text-editor.tsx`, pages under `src/app/(app)/books/`, Drizzle schema `src/server/db/schema/books.ts` and migration `0002_books`, `src/app/globals.css` (tokens).
- Changed: home page lists the author's books; `(app)` layout gains the styling baseline and the Concept panel slot.
- Dependencies: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` (exact pins).
- No new environment variables, secrets or API routes; all writes are server actions.
- Out of scope: plan items (E05), paragraphs and paragraph ids (E06), cowriter import/export (E07), co-authors.
