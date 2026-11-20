import { and, eq, isNull } from "drizzle-orm";
import { ZodError } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import { NotFound, type Actor } from "@/server/auth/actor";
import { BookValidationError } from "@/server/books/core";
import { addLanguage } from "@/server/books/languages";
import {
  createChapter,
  createPart,
  getOutline,
  moveChapter,
  moveChapterToPart,
  movePart,
  removeChapter,
  removePart,
  renameChapter,
  renamePart,
  restoreChapter,
  restorePart,
} from "@/server/books/structure";
import { getDb } from "@/server/db/client";
import { chapter } from "@/server/db/schema";
import { captureLogs } from "../helpers";
import { makeAuthor, makeBook, rejects, resetBooks } from "./book-helpers";

const ch = (
  author: Actor,
  bookId: string,
  code: string,
  partId?: string,
  title = `Chapter ${code}`,
) => createChapter(author, bookId, { code, titles: { EN: title }, partId });

const codesIn = async (author: Actor, bookId: string) => {
  const o = await getOutline(author, bookId);
  return {
    parts: o.parts.map((p) => `${p.titles.EN}: ${p.chapters.map((c) => c.code).join(",")}`),
    unparted: o.unparted.map((c) => c.code),
    removed: o.removedChapters.map((c) => c.code),
    removedParts: o.removedParts.map((p) => p.titles.EN),
  };
};

/** Positions of active chapters in each list are 0..n-1. */
async function expectDense(bookId: string) {
  const rows = await getDb()
    .select({ partId: chapter.partId, position: chapter.position })
    .from(chapter)
    .where(and(eq(chapter.bookId, bookId), isNull(chapter.removedAt)));
  const byPart = new Map<string, number[]>();
  for (const r of rows)
    byPart.set(String(r.partId), [...(byPart.get(String(r.partId)) ?? []), r.position]);
  for (const positions of byPart.values())
    expect(positions.sort((a, b) => a - b)).toEqual(positions.map((_, i) => i));
}

describe("book-structure: Author can manage parts", () => {
  beforeEach(resetBooks);

  it("Create and rename with a title per language", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await addLanguage(author, id, { code: "PT-BR", name: "Português" });
    const { id: p } = await createPart(author, id, { EN: "Book One" });
    await renamePart(author, id, p, { EN: "Book One", "PT-BR": "Livro Um" });
    expect((await getOutline(author, id)).parts[0]?.titles).toEqual({
      EN: "Book One",
      "PT-BR": "Livro Um",
    });
  });

  it("Titles must include the written-first language and only book languages", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (const titles of [{}, { EN: "" }, { FR: "Livre" }, { EN: "x".repeat(201) }, "Book", null])
      await rejects(() => createPart(author, id, titles), BookValidationError);
  });

  it("Remove a part with chapters: refused", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: p } = await createPart(author, id, { EN: "Book One" });
    await ch(author, id, "01", p);
    const { lines } = captureLogs();
    await rejects(() => removePart(author, id, p), BookValidationError);
    expect(lines.find((l) => l.event === "part.remove.refused")).toMatchObject({
      activeChapters: 1,
    });
  });

  it("Remove and restore an empty part: back at the end", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: one } = await createPart(author, id, { EN: "One" });
    await createPart(author, id, { EN: "Two" });
    await removePart(author, id, one);
    expect(await codesIn(author, id)).toMatchObject({ parts: ["Two: "], removedParts: ["One"] });
    await restorePart(author, id, one);
    expect(await codesIn(author, id)).toMatchObject({
      parts: ["Two: ", "One: "],
      removedParts: [],
    });
  });

  it("Moves parts up and down", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await createPart(author, id, { EN: "One" });
    const { id: two } = await createPart(author, id, { EN: "Two" });
    await movePart(author, id, two, "up");
    expect((await codesIn(author, id)).parts).toEqual(["Two: ", "One: "]);
  });

  it("Part limit", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (let i = 0; i < 30; i++) await createPart(author, id, { EN: `P${i}` });
    await rejects(() => createPart(author, id, { EN: "one more" }), BookValidationError);
  });
});

describe("book-structure: Chapter codes follow the scheme", () => {
  beforeEach(resetBooks);

  it("Valid codes", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (const code of ["00", "01", "99", "INT", "INT2"]) await ch(author, id, code);
    expect((await codesIn(author, id)).unparted).toEqual(["00", "01", "99", "INT", "INT2"]);
  });

  it("Invalid code", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (const code of ["1", "100", "INT10", "int", "A1", ""])
      await rejects(() => ch(author, id, code), ZodError);
    expect((await codesIn(author, id)).unparted).toEqual([]);
  });

  it("Duplicate code, including removed chapters", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: c1 } = await ch(author, id, "01");
    await rejects(() => ch(author, id, "01"), BookValidationError);
    await removeChapter(author, id, c1);
    const err = await rejects(() => ch(author, id, "01"), BookValidationError);
    expect(err.field).toBe("code");
    // Another book may use the same code.
    await ch(author, await makeBook(author, "Other"), "01");
  });

  it("Suggested code", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (const code of ["01", "02", "04"]) await ch(author, id, code);
    expect((await getOutline(author, id)).suggestedCode).toBe("03");
  });
});

describe("book-structure: Author can manage chapters", () => {
  beforeEach(resetBooks);

  it("Create in a part, with titles per language", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await addLanguage(author, id, { code: "PT-BR", name: "Português" });
    const { id: p } = await createPart(author, id, { EN: "Book One" });
    const { id: c } = await createChapter(author, id, {
      code: "01",
      titles: { EN: "Arrival" },
      partId: p,
    });
    await renameChapter(author, id, c, { EN: "Arrival", "PT-BR": "Chegada" });
    const outline = await getOutline(author, id);
    expect(outline.parts[0]?.chapters).toEqual([
      { id: c, code: "01", titles: { EN: "Arrival", "PT-BR": "Chegada" }, partId: p },
    ]);
  });

  it("Remove and restore: code and titles intact, back at the end of its part", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: p } = await createPart(author, id, { EN: "Book One" });
    await ch(author, id, "01", p);
    await ch(author, id, "02", p);
    const { id: c3 } = await ch(author, id, "03", p, "Storm");
    await ch(author, id, "04", p);
    await moveChapter(author, id, c3, "up");
    expect((await codesIn(author, id)).parts).toEqual(["Book One: 01,03,02,04"]);
    await removeChapter(author, id, c3);
    expect(await codesIn(author, id)).toMatchObject({
      parts: ["Book One: 01,02,04"],
      removed: ["03"],
    });
    await expectDense(id);
    await restoreChapter(author, id, c3);
    expect(await codesIn(author, id)).toMatchObject({
      parts: ["Book One: 01,02,04,03"],
      removed: [],
    });
    expect((await getOutline(author, id)).parts[0]?.chapters[3]?.titles).toEqual({ EN: "Storm" });
  });

  it("A chapter whose part is removed is restored to no part", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: p } = await createPart(author, id, { EN: "Book One" });
    const { id: c } = await ch(author, id, "01", p);
    await removeChapter(author, id, c);
    await removePart(author, id, p);
    await restoreChapter(author, id, c);
    expect(await codesIn(author, id)).toMatchObject({ parts: [], unparted: ["01"] });
  });
});

describe("book-structure: Reordering never changes codes", () => {
  beforeEach(resetBooks);

  it("Move a chapter up twice; codes unchanged", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: p } = await createPart(author, id, { EN: "Book One" });
    await ch(author, id, "01", p);
    await ch(author, id, "02", p);
    const { id: c3 } = await ch(author, id, "03", p);
    const { lines } = captureLogs();
    await moveChapter(author, id, c3, "up");
    await moveChapter(author, id, c3, "up");
    expect((await codesIn(author, id)).parts).toEqual(["Book One: 03,01,02"]);
    expect(lines.filter((l) => l.event === "chapter.moved").at(-1)).toMatchObject({
      chapterId: c3,
      code: "03",
      fromPartId: p,
      toPartId: p,
      position: 0,
    });
    await expectDense(id);
  });

  it("Move to another part: appended at the end, code kept", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: one } = await createPart(author, id, { EN: "One" });
    const { id: two } = await createPart(author, id, { EN: "Two" });
    await ch(author, id, "01", one);
    const { id: c2 } = await ch(author, id, "02", one);
    await ch(author, id, "03", one);
    await ch(author, id, "10", two);
    await moveChapterToPart(author, id, c2, two);
    expect((await codesIn(author, id)).parts).toEqual(["One: 01,03", "Two: 10,02"]);
    await moveChapterToPart(author, id, c2, "");
    expect(await codesIn(author, id)).toMatchObject({
      parts: ["One: 01,03", "Two: 10"],
      unparted: ["02"],
    });
    await expectDense(id);
  });

  it("Edges: nothing changes", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: a } = await ch(author, id, "01");
    const { id: b } = await ch(author, id, "02");
    await moveChapter(author, id, a, "up");
    await moveChapter(author, id, b, "down");
    expect((await codesIn(author, id)).unparted).toEqual(["01", "02"]);
    await rejects(() => moveChapter(author, id, a, "sideways"), ZodError);
  });

  it("Concurrent moves leave dense positions", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const ids: string[] = [];
    for (const code of ["01", "02", "03", "04", "05"]) ids.push((await ch(author, id, code)).id);
    await Promise.all([
      ...ids.map((c) => moveChapter(author, id, c, "up")),
      ...ids.map((c) => moveChapter(author, id, c, "down")),
    ]);
    await expectDense(id);
    expect((await codesIn(author, id)).unparted.sort()).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("A removed chapter can't be moved", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: c } = await ch(author, id, "01");
    await removeChapter(author, id, c);
    await rejects(() => moveChapter(author, id, c, "up"), NotFound);
  });
});

describe("book-structure: Book outline view", () => {
  beforeEach(resetBooks);

  it("Full outline and empty book", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    expect(await codesIn(author, id)).toEqual({
      parts: [],
      unparted: [],
      removed: [],
      removedParts: [],
    });
    const { id: one } = await createPart(author, id, { EN: "One" });
    const { id: two } = await createPart(author, id, { EN: "Two" });
    await ch(author, id, "01", one);
    await ch(author, id, "02", two);
    await ch(author, id, "00");
    const { id: gone } = await ch(author, id, "03", one);
    await removeChapter(author, id, gone);
    expect(await codesIn(author, id)).toEqual({
      parts: ["One: 01", "Two: 02"],
      unparted: ["00"],
      removed: ["03"],
      removedParts: [],
    });
  });
});
