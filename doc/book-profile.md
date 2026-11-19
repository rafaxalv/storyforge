---
feature: book-profile
epic: E02
change: e02-book-profile
status: draft
updated: 2026-11-19
# --- findability: keep these lists exact; agents grep them ---
files: [src/server/books/, src/server/books/access.ts, src/server/db/schema/books.ts, src/server/db/migrations/0002_books.sql, src/shared/id-scheme.ts, src/shared/rich-text.ts, src/client/rich-text-editor.tsx, src/app/globals.css, src/app/(app)/page.tsx, src/app/(app)/books/]
entrypoints: ["/", "/books/new", "/books/[bookId]", "/books/[bookId]/profile", "/books/[bookId]/concept", "?panel=concept"]
loggers: [storyforge:books, storyforge:access]
events: [book.created, book.deleted, book.delete.refused, book.profile.updated, book.conflict, book.language.added, book.language.updated, book.language.moved, book.language.removed, book.rule.added, book.rule.updated, book.rule.moved, book.rule.removed, book.labels.updated, concept.saved, concept.rejected, part.created, part.renamed, part.moved, part.removed, part.restored, part.remove.refused, chapter.created, chapter.renamed, chapter.moved, chapter.removed, chapter.restored, book.limit, books.action]
env: []
specs: [book-profile, book-structure]
depends_on: [auth]
keywords: [book, profile, languages, written-first, standing rules, truth labels, people notes, id scheme, chapter code, prologue, epilogue, interlude, parts, chapters, outline, reorder, concept, autosave, side panel, tiptap, rich text, dark mode]
---

# Book profile & structure

_Draft written at plan time; finalized in the doc phase._

## What it does

Authors create books, edit each book's profile (languages, standing rules, truth labels, people notes, ID scheme), lay out parts and chapters with cowriter chapter codes, and write the Concept with autosave, on its own page or in a side panel. Stories: E02/US-1 to US-3.

## How it works

See `openspec/changes/e02-book-profile/design.md` until this section is written.

## Known gaps

_To be filled in the doc phase._
