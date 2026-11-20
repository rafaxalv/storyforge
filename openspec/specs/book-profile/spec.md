# book-profile Specification

## Purpose
Lets an author create, list and delete their books, set each book's profile (title, one-liner, length target and limit, languages with one written-first, standing rules, truth labels, people notes, paragraph-ID scheme) and write its Concept with autosave, on its own page or beside any book page. Books are private to their owner.

## Requirements

### Requirement: Author can create a book
A signed-in author SHALL be able to create a book by giving a title (1–200 characters) and a first language (code and display name). The new book SHALL get the cowriter paragraph-ID scheme, the five default truth labels in order (DOCUMENTED, STRONGLY SUPPORTED, FAMILY TRADITION, PLAUSIBLE RECONSTRUCTION, FICTIONAL), that language marked written-first, and an empty Concept. An author SHALL be able to own at most 100 books.

#### Scenario: Create a book
- **WHEN** an author creates a book titled "The Crossing" with language EN "English"
- **THEN** the book opens on its outline page, its profile shows EN as the written-first language, the default truth labels in order, the cowriter ID scheme, and an empty Concept

#### Scenario: Invalid title
- **WHEN** an author submits an empty title or one longer than 200 characters
- **THEN** a validation message is shown and no book is created

#### Scenario: Book limit
- **WHEN** an author who owns 100 books tries to create another
- **THEN** no book is created and a message explains the limit

### Requirement: Home lists the author's books
The home page SHALL list the signed-in author's own books (title, one-liner, last change), most recently changed first, and no one else's.

#### Scenario: Home lists only own books
- **WHEN** two authors each have books and one of them opens the home page
- **THEN** only that author's books are listed, newest change first

### Requirement: Books are private to their owner
Every read and write of a book or anything inside it SHALL first resolve the signed-in author and check that they own the book. A book that does not exist or belongs to someone else SHALL look the same: pages answer "not found" and actions change nothing. Book titles, rule text, Concept text and people notes SHALL never be written to logs.

#### Scenario: Another author's book
- **WHEN** an author opens the profile, outline or Concept URL of another author's book, or sends any book action with its id
- **THEN** the page shows "not found", the action reports "not found", and nothing in that book changes

#### Scenario: Signed out
- **WHEN** a signed-out visitor opens any book page
- **THEN** they are sent to sign in and returned to that page afterwards

#### Scenario: Logs carry ids only
- **WHEN** an author creates a book, edits its profile and saves its Concept
- **THEN** the log lines for those actions carry the book id and the event name but none of the text the author typed

### Requirement: Author can edit the book profile
The profile page SHALL let the owner edit the title (1–200 characters), one-liner (up to 500 characters), length target and hard limit (whole numbers of words from 1 to 2,000,000, both optional; when both are set, the target SHALL NOT exceed the limit), and people notes (plain text up to 20,000 characters). Each save SHALL carry the version the author started from; if the profile changed since, nothing SHALL be saved and the author SHALL be told to reload.

#### Scenario: Save profile fields
- **WHEN** the owner sets a one-liner, a target of 80,000 and a limit of 95,000 words, and people notes, then saves
- **THEN** the values are stored and shown on reload

#### Scenario: Target above limit
- **WHEN** the owner sets a target of 100,000 and a limit of 90,000 words
- **THEN** a validation message is shown and nothing is saved

#### Scenario: Stale save
- **WHEN** the profile is saved in one tab and then saved again from an older tab
- **THEN** the second save is refused with a "changed elsewhere, reload" message and the first save's values remain

### Requirement: Book languages are well-formed
A book SHALL have between 1 and 10 languages, each with a code unique in the book and a display name (1–60 characters). A code SHALL be two letters, optionally followed by a dash and two letters, stored uppercase (`EN`, `PT-BR`). Exactly one language SHALL be marked written-first.

#### Scenario: Codes are normalized
- **WHEN** the owner adds a language with code `pt-br`
- **THEN** it is stored as `PT-BR`

#### Scenario: Language limit
- **WHEN** the owner of a book with 10 languages adds another
- **THEN** it is refused with a message explaining the limit

### Requirement: Author can manage book languages
The owner SHALL be able to add, rename and reorder languages, change which one is written-first, and remove any language except the written-first one. Removing a language SHALL remove its part and chapter titles, after the owner confirms.

#### Scenario: Add and reorder
- **WHEN** the owner of a book with EN adds PT-BR "Português (Brasil)" and moves it above EN
- **THEN** the profile lists PT-BR then EN, and EN stays written-first

#### Scenario: Change written-first
- **WHEN** the owner marks PT-BR as written-first
- **THEN** PT-BR is the only written-first language

#### Scenario: Invalid or duplicate code
- **WHEN** the owner adds a language with code `english` or a code the book already has
- **THEN** a validation message is shown and no language is added

#### Scenario: Remove the written-first language
- **WHEN** the owner tries to remove the written-first language
- **THEN** it is refused with a message to pick another written-first language first

#### Scenario: Remove a language with titles
- **WHEN** the owner removes PT-BR after confirming, and chapters had PT-BR titles
- **THEN** PT-BR is gone from the profile and those chapters show no PT-BR title

### Requirement: Author can manage standing rules
A book SHALL have up to 100 standing rules, each a rich-text body (1–10,000 characters of text). Rules SHALL be shown numbered from 1 in their order, each with the date it was last changed. The owner SHALL be able to add, edit, reorder and delete rules; numbers SHALL follow the current order.

#### Scenario: Add rules
- **WHEN** the owner adds two rules on 2026-11-20
- **THEN** they show as 1 and 2, each dated 2026-11-20

#### Scenario: Reorder renumbers
- **WHEN** the owner moves rule 2 above rule 1
- **THEN** the former rule 2 now shows as 1

#### Scenario: Edit updates the date
- **WHEN** the owner edits rule 1 on a later day
- **THEN** rule 1 shows that later date and its new text

### Requirement: Author can manage truth labels
A book SHALL have an ordered list of 1–20 truth labels, each 1–60 characters, unique in the book (case-insensitive). The owner SHALL be able to add, rename, reorder and remove labels, and reset them to the cowriter defaults.

#### Scenario: Edit labels
- **WHEN** the owner adds "RUMOUR", moves it to the top and removes "FICTIONAL"
- **THEN** the list starts with RUMOUR and no longer has FICTIONAL

#### Scenario: Last label
- **WHEN** the owner tries to remove the only remaining label
- **THEN** it is refused

#### Scenario: Reset
- **WHEN** the owner resets the labels
- **THEN** the list is the five cowriter defaults in order

### Requirement: Paragraph-ID scheme is shown on the profile
The profile SHALL show the book's paragraph-ID scheme with an example. In v1 the only scheme is the cowriter one: chapter code, a dot, a three-digit row (`03.014`), prologue `00`, epilogue `99`, interludes `INT`/`INT1`–`INT9`, and letter suffixes for insertions (`03.014a`).

#### Scenario: Scheme shown
- **WHEN** the owner opens the profile
- **THEN** it names the cowriter scheme and shows examples `03.014`, `00.001`, `INT.002` and `03.014a`

### Requirement: Author can delete a book
The owner SHALL be able to delete a book after typing its exact title. Deletion SHALL remove the book and everything in it at once.

#### Scenario: Confirmed deletion
- **WHEN** the owner types the exact title and confirms
- **THEN** the book, its languages, rules, Concept, parts and chapters are removed and the author is back on the home page without it

#### Scenario: Wrong confirmation
- **WHEN** the typed title does not match
- **THEN** nothing is deleted

#### Scenario: Account deletion removes books
- **WHEN** an author with books deletes their account
- **THEN** no row of their books remains

### Requirement: Concept is rich text with a fixed set of formats
Each book SHALL have one Concept, a rich-text document using only paragraphs, headings (levels 1–3), bullet and numbered lists, block quotes, horizontal rules, hard breaks, bold, italic and strike, with up to 200,000 characters of text. The server SHALL reject any document with other node or mark types, or one that is too large.

#### Scenario: Disallowed content
- **WHEN** a save request carries a node type outside the allowed list, a link, or raw HTML
- **THEN** the save is refused and the stored Concept is unchanged

#### Scenario: Too large
- **WHEN** a save request carries more than 200,000 characters of text
- **THEN** the save is refused and the stored Concept is unchanged

### Requirement: Concept autosaves without overwriting newer text
The editor SHALL save automatically about one second after the author stops typing and when they leave the page, and SHALL show "Saving…", "Saved" or an error. Each save SHALL carry the version it started from; a save from an older version SHALL be refused, and the editor SHALL tell the author to reload while keeping their unsaved text on screen.

#### Scenario: Autosave
- **WHEN** the owner types in the Concept and pauses
- **THEN** the status shows "Saved" and the text is there after a reload

#### Scenario: Conflict
- **WHEN** the Concept is saved in one tab and then edited and saved in an older tab
- **THEN** the older tab shows "changed elsewhere, reload", keeps its text on screen, and the stored Concept is the first tab's

### Requirement: Concept opens beside any book page
Every book page SHALL offer a control that opens the Concept in a side panel next to the page, editable with the same autosave, and a control that closes it. The panel state SHALL be part of the URL, so reloading keeps it open. On narrow screens the panel SHALL cover the page and have a close control.

#### Scenario: Open beside the outline
- **WHEN** the owner opens the Concept panel on the outline page
- **THEN** the outline and the Concept are both visible, and a reload keeps the panel open

#### Scenario: Edit in the panel
- **WHEN** the owner types in the panel and then opens the Concept page
- **THEN** the Concept page shows the same text
