## Automated tests

Prerequisites: Postgres up (`docker-compose up -d`), `npm run db:migrate`; E2E needs `npm run build` and Playwright's Chromium.

- Command: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`
- `tests/unit/id-scheme.test.ts` → book-structure / "Valid codes", "Invalid code", "Suggested code"; book-profile / "Scheme shown" (examples constant)
- `tests/unit/rich-text.test.ts` → book-profile / "Disallowed content" (links, images, `code`, raw HTML strings as nodes, unknown attrs, depth > 20, oversize text and JSON), allowed StarterKit subset passes
- `tests/unit/book-validation.test.ts` → book-profile / "Invalid title", "Target above limit", "Invalid or duplicate code" (format half), title-map rules, truth-label rules
- `tests/unit/book-action.test.ts` → `bookAction` maps ZodError / validation / Conflict / NotFound / Forbidden to `{ error }`, rethrows others
- `tests/integration/books.test.ts` → book-profile / "Create a book", "Home lists only own books", "Book limit", "Save profile fields", "Stale save", "Confirmed deletion", "Wrong confirmation"
- `tests/integration/book-languages.test.ts` → book-profile / "Add and reorder", "Change written-first", "Invalid or duplicate code", "Remove the written-first language", "Remove a language with titles"; language limit
- `tests/integration/book-rules-labels.test.ts` → book-profile / "Add rules", "Reorder renumbers", "Edit updates the date", "Edit labels", "Last label", "Reset"; rule and label limits
- `tests/integration/concept.test.ts` → book-profile / "Autosave" (save + read back, version increments), "Conflict" (stale version refused, stored text kept), "Disallowed content" (server rejects, `concept.rejected`)
- `tests/integration/structure.test.ts` → book-structure / "Create and rename", "Remove a part with chapters", "Remove and restore an empty part", "Valid codes", "Duplicate code" (incl. removed chapters), "Suggested code", "Create in a part", "Titles per language", "Remove and restore", "Move a chapter up" (codes unchanged, dense positions), "Move to another part", "Edges", "Full outline", "Empty book"; part and chapter limits; two concurrent moves leave dense positions
- `tests/integration/books-access.test.ts` → book-profile / "Another author's book"; book-structure / "Only the owner": every domain function called by the other user (→ not found, nothing changed), malformed ids, child ids (part, chapter, rule, language) from another book
- `tests/integration/books-purge.test.ts` → book-profile / "Account deletion removes books" (cascade + `books` purge step)
- `tests/integration/log-hygiene.test.ts` (extended) → book-profile / "Logs carry ids only": sentinel strings in title, one-liner, notes, rule, Concept, part and chapter titles never appear in captured logs
- `tests/e2e/books.spec.ts` → full author flow (US-1, US-2, US-3) incl. keyboard moves with focus kept, Concept autosave + reload, panel open beside the outline and kept after reload, signed-out redirect to a book page and back
- `tests/e2e/theme.spec.ts` → dark and light colour schemes: body text vs background contrast ≥ 4.5:1 on home, sign-in, settings, profile and outline
- Existing E00 and E01 suites stay green

## Interactive cases

| ID | Scenario | Steps | Expected | Tool | Result |
|----|----------|-------|----------|------|--------|
| T1 | book-profile: Create a book | 1. Sign in on the test server 2. Home → New book 3. title "The Crossing", EN "English" 4. submit | Outline page of the new book; profile shows EN written-first, five default truth labels, cowriter scheme; home lists it | playwright | todo |
| T2 | book-profile: Edit profile + stale save | 1. Set one-liner, target 80,000, limit 95,000, notes; save; reload 2. Target 100,000 / limit 90,000 3. Open profile in two tabs, save in A, then save in B | 1. Values kept 2. Validation message 3. B shows "changed elsewhere, reload"; A's values stored | playwright | todo |
| T3 | book-profile: Languages | Add PT-BR "Português (Brasil)", move it above EN, make it written-first, try to remove it, make EN written-first, remove PT-BR (confirm); also try code `english` | Order and flags as specified; removing written-first refused; removal strips PT-BR titles; invalid code refused | playwright | todo |
| T4 | book-profile: Standing rules | Add two rules with bold and a list, move rule 2 up, edit rule 1 | Numbers follow order, dates shown, formatting kept after reload | playwright | todo |
| T5 | book-profile: Truth labels | Add RUMOUR, move to top, remove FICTIONAL, try removing down to zero, reset | List as specified; last label refused; reset restores the five defaults | playwright | todo |
| T6 | book-structure: Parts and chapters | Create parts "Book One"/"Book Two", chapters `00`, `01`, `02`, `INT`, `99`; try `1`, `INT10`, a duplicate; check suggested code after `01`,`02`,`04` | Valid codes created; invalid and duplicate refused with messages; suggestion `03` | playwright | todo |
| T7 | book-structure: Keyboard reorder | Using only Tab/Enter: move `03` up twice, move `02` to "Book Two", try moving the first item up | Order `03`,`01`,`02` with codes unchanged and focus on the moved row's control; `02` at end of Book Two; edge buttons disabled | playwright | todo |
| T8 | book-structure: Remove/restore | Remove chapter `03`, try to remove a part with chapters, remove an empty part, restore both | `03` under Removed then back at end of its part with titles; non-empty part refused; empty part back at end | playwright | todo |
| T9 | book-profile: Concept autosave + conflict | Type in Concept, wait, reload; then open it in two tabs, type and save in A, then type in B | "Saved", text kept after reload; B shows "changed elsewhere, reload", keeps its text, copy button works; stored text is A's | playwright | todo |
| T10 | book-profile: Concept panel | On the outline open the Concept panel, type, reload; open the Concept page; resize to 375 px wide | Both visible side by side; panel kept after reload; Concept page shows the typed text; at 375 px the panel covers the page with a close control and focus inside | playwright | todo |
| T11 | book-profile: Another author's book | Sign in as a second user, open the first user's book URLs (outline, profile, concept); replay a captured server action with the first user's ids | Not-found page; action answers "Not found."; `access.denied` warn; DB unchanged | playwright + http | todo |
| T12 | book-profile: Delete a book | Profile → Delete → wrong title, then exact title | Wrong title: nothing deleted; exact: home without the book; no rows left in the six tables for that book | playwright + console | todo |
| T13 | Styling: dark mode | Toggle the browser to dark, visit home, sign-in, settings, profile, outline | All text readable (light text on dark background), focus rings visible | playwright | todo |
| T14 | Security: dependencies | `npm audit --omit=dev`; check TipTap pins in package.json; `grep -r dangerouslySetInnerHTML src/` | 0 vulnerabilities; exact versions; no matches | console | todo |
| T15 | CI | Push `epic/e02-book-profile` (with the author's OK) | All CI jobs green | manual | todo |

## Observability checks

- [ ] `storyforge:books` emits `book.created` with `userId`, `bookId`, `languageCode` and the action's `requestId` in T1
- [ ] `book.profile.updated` with `fields` and `version`, and `book.conflict` (warn, `target: "profile"`) in T2
- [ ] `book.language.removed` with `code` and `titlesStripped` in T3
- [ ] `concept.saved` with `version`, `chars`, `ms`, and `book.conflict` (`target: "concept"`) in T9
- [ ] `chapter.moved` with `chapterId`, `code`, `fromPartId`, `toPartId`, `position` in T7; `part.remove.refused` in T8
- [ ] `access.denied` (warn) with `op` and `reason` in T11, and no book data in that line
- [ ] With `LOG_LEVEL=debug`, `books.action` entry lines with `op` and `ms` appear for T1
- [ ] Across T1–T12, `logs/app.log` contains none of the titles, notes, rule or Concept text typed (grep)

## Exit criteria

- [ ] Automated tests green
- [ ] All interactive cases `pass`
- [ ] Observability checks visible
- [ ] No known regressions in previously closed epics (E00, E01 suites and their interactive smoke: health, sign-in)
