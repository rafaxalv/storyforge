## 1. Foundations

- [x] 1.1 Add `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` (exact pins: 3.32.3, the newest release at least two weeks old) and change "TipTap 2" to the pinned line in ARCHITECTURE.md and `openspec/config.yaml`; verify install, `npm audit --omit=dev` clean, build passes
- [x] 1.2 Styling baseline: `src/app/globals.css` (tokens, dark mode, forms, buttons, focus rings) imported in the root layout, inline body style removed; verify E01 pages readable in light and dark (screenshots) and the E01 e2e suite green
- [x] 1.3 `src/shared/id-scheme.ts` (chapter-code regex, kinds, `suggestNextCode`, cowriter-v1 scheme + examples); verify unit tests
- [x] 1.4 `src/shared/rich-text.ts` (allowlisted schema as a hand-written walker rather than zod, limits, depth, size, `emptyDoc()`); verify unit tests for allowed and rejected documents

## 2. Database

- [x] 2.1 `src/server/db/schema/books.ts` (book, book_language, standing_rule, concept, part, chapter; cascades, unique and partial-unique indexes) exported from the schema index; verify `npm run db:generate` produces `0002_books` and `npm run db:migrate` applies it to the dev and test databases
- [x] 2.2 Register the `books` purge step (`src/server/books/purge.ts`, wired in `src/worker.ts`); verify the purge integration test runs it and account deletion leaves no book rows

## 3. Domain module

- [x] 3.1 `NotFound` error in `actor.ts` (maps like `Forbidden`) and `ownedBook()` / `withBook()` in `src/server/books/core.ts`; verify unit + integration tests (missing, malformed, foreign → not found)
- [x] 3.2 Books: `createBook`, `listBooks`, `getBookHeader`, `getProfile`, `updateProfile` (versioned), `deleteBook` (typed title), owner limit; verify integration tests
- [x] 3.3 Languages: add, rename, move, set written-first, remove (strips titles); verify integration tests incl. invariants
- [x] 3.4 Standing rules: add, update, move, remove, numbering by order, dates; verify integration tests
- [x] 3.5 Truth labels: replace list (versioned), reset to defaults, validation; verify integration tests
- [x] 3.6 Concept: `getConcept`, `saveConcept` (versioned, schema-checked); verify integration tests incl. conflict and rejected content
- [x] 3.7 Parts: create, rename, move, remove (only when empty), restore; verify integration tests
- [x] 3.8 Chapters: create (code rules, suggestion, duplicates), rename, move (up/down/to part), remove, restore; `getOutline`; verify integration tests incl. "codes never change" and dense positions

## 4. Pages and UI

- [x] 4.1 `bookAction` wrapper in `src/app/(app)/books/action-result.ts` (actions in `actions.ts`); verify unit test of the error mapping
- [x] 4.2 Home page lists books; `/books/new` form; verify in the browser and e2e
- [x] 4.3 Book layout (`requirePageActor`, `notFound()`, tabs, panel toggle); verify foreign/missing book → 404 page
- [x] 4.4 Profile page: profile form with version, languages list, ID scheme, delete-book dialog; verify in the browser
- [x] 4.5 `src/client/rich-text-editor.tsx` (dynamic, StarterKit subset, read-only mode) and the standing-rules editor; verify in the browser
- [x] 4.6 Truth-labels editor (add, rename, reorder, remove, reset); verify in the browser
- [x] 4.7 Outline page: parts, chapters, unparted, Removed; add/rename forms with code hint and suggestion; move buttons (no-JS forms + focus restore); remove/restore; verify a keyboard-only run in the browser
- [x] 4.8 Concept page with autosave (debounce, single flight, pagehide save, status, conflict handling with copy button); verify in the browser incl. a two-tab conflict
- [x] 4.9 Concept side panel (`?panel=concept`, two columns ≥ 1,000 px, overlay below with focus management); verify in the browser at desktop and mobile widths

## 5. Observability

- [x] 5.1 `storyforge:books` events from design.md (book, language, rule, labels, concept, part, chapter, limit, conflict, refusals) with ids and counts only; `LOG_LEVEL=debug` action entry + timing; verify in a manual run that one action's lines share its `requestId`
- [x] 5.2 Review every new log call for text fields; verify with the log-hygiene sentinel test

## 6. Tests

- [x] 6.1 Unit tests: `tests/unit/id-scheme.test.ts`, `tests/unit/rich-text.test.ts`, `tests/unit/book-validation.test.ts`, `tests/unit/book-action.test.ts`; verify green
- [x] 6.2 Integration tests: `tests/integration/books.test.ts`, `book-languages.test.ts`, `book-rules-labels.test.ts`, `concept.test.ts`, `structure.test.ts`, `books-access.test.ts`, `books-purge.test.ts`, and the book flow added to `log-hygiene.test.ts`; verify green
- [x] 6.3 E2E: `tests/e2e/books.spec.ts` (create → profile → languages → rules → labels → outline with keyboard moves, remove/restore → Concept autosave + reload → panel → delete) and `tests/e2e/theme.spec.ts` (light/dark contrast); verify green
- [x] 6.4 Security checks from design.md, each covered: A01 every action refused for the other user and for child ids from another book (`books-access.test.ts`); A03 `npm audit --omit=dev` clean and exact pins (test-plan T14); A05/A08 rich-text allowlist rejects links, HTML, unknown nodes/attrs, oversize and deep docs (`rich-text.test.ts`, `concept.test.ts`) and a grep shows no `dangerouslySetInnerHTML` in `src/`; A06 limits and concurrent moves (`structure.test.ts`, `books.test.ts`); A09 sentinel log test; A10 conflict keeps text (e2e + T9); verify each listed test passes
- [ ] 6.5 Run the full suite (`npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`) and execute test-plan.md; every row `pass`

## 7. Docs

- [ ] 7.1 Finalize `doc/book-profile.md` (findability header: files, entrypoints, loggers, events, env, specs; how it works; known gaps), update the `doc/README.md` index, add the E02 conventions (book ownership via `ownedBook`, rich-text node set, versioned saves, ordering, styling tokens) to `openspec/config.yaml` context, and note in `doc/auth.md` that the `books` purge step is registered; verify `grep -l "src/server/books" doc/*.md` finds the doc
