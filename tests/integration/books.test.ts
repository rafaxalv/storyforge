import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createBook,
  deleteBook,
  getBookHeader,
  getProfile,
  listBooks,
  updateProfile,
} from "@/server/books/books";
import { getConcept } from "@/server/books/concept";
import { BookValidationError, Conflict } from "@/server/books/core";
import { getDb } from "@/server/db/client";
import { book, bookLanguage, chapter, concept, part, standingRule } from "@/server/db/schema";
import { DEFAULT_TRUTH_LABELS, LIMITS } from "@/shared/books";
import { emptyDoc } from "@/shared/rich-text";
import { captureLogs } from "../helpers";
import { makeAuthor, makeBook, rejects, resetBooks } from "./book-helpers";
import { addRule } from "@/server/books/rules";
import { createChapter, createPart } from "@/server/books/structure";

const profile = (over: Record<string, unknown> = {}) => ({
  title: "The Crossing",
  oneLiner: "Two brothers cross the sea.",
  lengthTarget: "80000",
  lengthLimit: "95000",
  peopleNotes: "Grandfather Joaquim",
  ...over,
});

describe("book-profile: Author can create a book", () => {
  beforeEach(resetBooks);

  it("Create a book: defaults, written-first language, empty Concept", async () => {
    const author = await makeAuthor();
    const { lines } = captureLogs();
    const { id } = await createBook(author, {
      title: "  The Crossing ",
      languageCode: "en",
      languageName: "English",
    });
    const p = await getProfile(author, id);
    expect(p.title).toBe("The Crossing");
    expect(p.languages).toEqual([
      expect.objectContaining({ code: "EN", name: "English", writtenFirst: true }),
    ]);
    expect(p.truthLabels).toEqual([...DEFAULT_TRUTH_LABELS]);
    expect(p.idScheme).toBe("cowriter-v1");
    expect(p.rules).toEqual([]);
    expect((await getConcept(author, id)).body).toEqual(emptyDoc());
    expect(lines.find((l) => l.event === "book.created")).toMatchObject({
      userId: author.userId,
      bookId: id,
      languageCode: "EN",
    });
  });

  it("Invalid title: nothing created", async () => {
    const author = await makeAuthor();
    for (const title of ["", "   ", "x".repeat(201)]) {
      await rejects(
        () => createBook(author, { title, languageCode: "EN", languageName: "English" }),
        ZodError,
      );
    }
    expect(await listBooks(author)).toEqual([]);
  });

  it("Book limit: the 101st book is refused", async () => {
    const author = await makeAuthor();
    await getDb()
      .insert(book)
      .values(
        Array.from({ length: LIMITS.books }, (_, i) => ({
          ownerId: author.userId,
          title: `B${i}`,
          truthLabels: ["X"],
        })),
      );
    const { lines } = captureLogs();
    const err = await rejects(() => makeBook(author), BookValidationError);
    expect(err.message).toContain("100");
    expect(lines.find((l) => l.event === "book.limit")).toMatchObject({ kind: "books" });
  });
});

describe("book-profile: Home lists the author's books", () => {
  beforeEach(resetBooks);

  it("Home lists only own books, newest change first", async () => {
    const [alice, bob] = [await makeAuthor("Alice"), await makeAuthor("Bob")];
    const first = await makeBook(alice, "First");
    const second = await makeBook(alice, "Second");
    await makeBook(bob, "Bob's");
    const v = (await getProfile(alice, first)).version;
    await updateProfile(alice, first, profile({ title: "First" }), v);
    expect((await listBooks(alice)).map((b) => b.id)).toEqual([first, second]);
    expect((await listBooks(bob)).map((b) => b.title)).toEqual(["Bob's"]);
  });
});

describe("book-profile: Author can edit the book profile", () => {
  beforeEach(resetBooks);

  it("Save profile fields", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { lines } = captureLogs();
    const { version } = await updateProfile(author, id, profile(), 1);
    expect(version).toBe(2);
    expect(await getProfile(author, id)).toMatchObject({
      oneLiner: "Two brothers cross the sea.",
      lengthTarget: 80000,
      lengthLimit: 95000,
      peopleNotes: "Grandfather Joaquim",
      version: 2,
    });
    expect(lines.find((l) => l.event === "book.profile.updated")).toMatchObject({
      fields: ["oneLiner", "lengthTarget", "lengthLimit", "peopleNotes"],
      version: 2,
    });
    // Empty word counts clear them.
    await updateProfile(author, id, profile({ lengthTarget: "", lengthLimit: "" }), 2);
    expect(await getProfile(author, id)).toMatchObject({ lengthTarget: null, lengthLimit: null });
  });

  it("Target above limit, and other invalid values", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (const bad of [
      { lengthTarget: "100000", lengthLimit: "90000" },
      { lengthTarget: "1.5" },
      { lengthLimit: "0" },
      { lengthLimit: "2000001" },
      { oneLiner: "x".repeat(501) },
      { peopleNotes: "x".repeat(20_001) },
    ]) {
      await rejects(() => updateProfile(author, id, profile(bad), 1), ZodError);
    }
    expect((await getProfile(author, id)).version).toBe(1);
  });

  it("Stale save: refused, first save kept", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await updateProfile(author, id, profile({ oneLiner: "from tab A" }), 1);
    const { lines } = captureLogs();
    await rejects(
      () => updateProfile(author, id, profile({ oneLiner: "from tab B" }), 1),
      Conflict,
    );
    expect((await getProfile(author, id)).oneLiner).toBe("from tab A");
    expect(lines.find((l) => l.event === "book.conflict")).toMatchObject({
      target: "profile",
      expected: 1,
    });
  });
});

describe("book-profile: Author can delete a book", () => {
  beforeEach(resetBooks);

  it("Wrong confirmation: nothing deleted", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author, "The Crossing");
    for (const typed of ["the crossing", "The Crossin", "", undefined]) {
      await rejects(() => deleteBook(author, id, typed), BookValidationError);
    }
    expect((await getBookHeader(author, id)).title).toBe("The Crossing");
  });

  it("Confirmed deletion removes the book and everything in it", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author, "The Crossing");
    const { id: partId } = await createPart(author, id, { EN: "Book One" });
    await createChapter(author, id, { code: "01", titles: { EN: "Arrival" }, partId });
    await addRule(author, id, {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Rule" }] }],
    });
    await deleteBook(author, id, "The Crossing");
    expect(await listBooks(author)).toEqual([]);
    for (const table of [bookLanguage, standingRule, concept, part, chapter]) {
      expect(await getDb().select().from(table).where(eq(table.bookId, id))).toEqual([]);
    }
  });
});
