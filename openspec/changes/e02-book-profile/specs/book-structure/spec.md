## ADDED Requirements

### Requirement: Author can manage parts
A book SHALL have up to 30 parts, each with a title per book language (0–200 characters each; at least the written-first title is required) and a position. The owner SHALL be able to create, rename, reorder and remove parts. A part SHALL be removable only when it has no chapters that are not removed. A removed part SHALL be listed under "Removed" and SHALL be restorable to the end of the parts list.

#### Scenario: Create and rename
- **WHEN** the owner creates a part "Book One" and adds the PT-BR title "Livro Um"
- **THEN** the outline shows the part with both titles

#### Scenario: Remove a part with chapters
- **WHEN** the owner tries to remove a part that still has chapters
- **THEN** it is refused with a message to move or remove those chapters first

#### Scenario: Remove and restore an empty part
- **WHEN** the owner removes an empty part and then restores it
- **THEN** it disappears from the outline into "Removed", then comes back at the end of the parts list

### Requirement: Chapter codes follow the scheme
A chapter code SHALL be one of: two digits `01`–`98` (regular chapters), `00` (prologue), `99` (epilogue), `INT` or `INT1`–`INT9` (interludes). A code SHALL be unique in its book, including removed chapters, and SHALL NOT change after the chapter is created. When creating a chapter, the form SHALL suggest the lowest unused regular code. The same rules SHALL be enforced on the server and shown in the form.

#### Scenario: Valid codes
- **WHEN** the owner creates chapters with codes `00`, `01`, `99`, `INT` and `INT2`
- **THEN** all are created

#### Scenario: Invalid code
- **WHEN** the owner submits code `1`, `100`, `INT10`, `int` or `A1`
- **THEN** a validation message is shown and no chapter is created

#### Scenario: Duplicate code
- **WHEN** the owner submits a code used by another chapter of the book, removed or not
- **THEN** a validation message is shown and no chapter is created

#### Scenario: Suggested code
- **WHEN** the book has chapters `01`, `02` and `04` and the owner opens the new-chapter form
- **THEN** the suggested code is `03`

### Requirement: Author can manage chapters
A book SHALL have up to 200 chapters. Each chapter SHALL have a code, a title per book language (0–200 characters each; at least the written-first title is required), an optional part, and a position within its part (or within the "no part" group). The owner SHALL be able to create, rename, reorder, move to another part, remove and restore chapters. A restored chapter SHALL return to the end of its part, or of the "no part" group if its part is removed.

#### Scenario: Create in a part
- **WHEN** the owner creates chapter `01` "Arrival" in part "Book One"
- **THEN** the outline shows `01 Arrival` under "Book One"

#### Scenario: Titles per language
- **WHEN** the book has EN and PT-BR and the owner sets "Arrival" and "Chegada" on chapter `01`
- **THEN** both titles are stored and shown

#### Scenario: Remove and restore
- **WHEN** the owner removes chapter `03` and then restores it
- **THEN** it leaves the outline for "Removed", then comes back with code `03`, its titles intact, at the end of its part

### Requirement: Reordering never changes codes
Moving parts or chapters (up, down, or to another part) SHALL change only their positions and part, never a chapter code. Every move SHALL be available as a button reachable and operable by keyboard, and the moved item SHALL keep focus after the move.

#### Scenario: Move a chapter up
- **WHEN** the outline lists `01`, `02`, `03` in a part and the owner moves `03` up twice with the keyboard
- **THEN** the order is `03`, `01`, `02`, all codes unchanged, and focus is on `03`'s move control

#### Scenario: Move to another part
- **WHEN** the owner moves chapter `02` from "Book One" to "Book Two"
- **THEN** `02` appears at the end of "Book Two" with code `02`

#### Scenario: Edges
- **WHEN** the owner moves the first item up or the last item down
- **THEN** the control is disabled and nothing changes

### Requirement: Book outline view
The outline page SHALL show the book's parts in order, each with its chapters in order (code and written-first title, with other-language titles beside it), then chapters with no part, then a collapsed "Removed" list of removed parts and chapters with restore controls. An empty book SHALL show a prompt to add the first chapter.

#### Scenario: Full outline
- **WHEN** the book has two parts, chapters in each, one chapter with no part and one removed chapter
- **THEN** the outline shows both parts with their chapters in order, the unparted chapter after them, and the removed chapter only under "Removed"

#### Scenario: Empty book
- **WHEN** the owner opens the outline of a new book
- **THEN** it shows a prompt and a control to add the first chapter

#### Scenario: Only the owner
- **WHEN** another author sends a create, rename, move, remove or restore action for a part or chapter of this book
- **THEN** the action reports "not found" and nothing changes
