import { ZodError } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import { getBookHeader } from "@/server/books/books";
import { BookValidationError } from "@/server/books/core";
import {
  addLanguage,
  moveLanguage,
  removeLanguage,
  renameLanguage,
  setWrittenFirst,
} from "@/server/books/languages";
import { createChapter, createPart, getOutline } from "@/server/books/structure";
import { captureLogs } from "../helpers";
import { makeAuthor, makeBook, rejects, resetBooks } from "./book-helpers";

const codes = async (actor: Parameters<typeof getBookHeader>[0], id: string) =>
  (await getBookHeader(actor, id)).languages.map((l) => `${l.code}${l.writtenFirst ? "*" : ""}`);

describe("book-profile: Book languages", () => {
  beforeEach(resetBooks);

  it("Add and reorder; codes are normalized", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: pt } = await addLanguage(author, id, { code: "pt-br", name: "Português (Brasil)" });
    expect(await codes(author, id)).toEqual(["EN*", "PT-BR"]);
    await moveLanguage(author, id, pt, "up");
    expect(await codes(author, id)).toEqual(["PT-BR", "EN*"]);
    await moveLanguage(author, id, pt, "up"); // edge: nothing changes
    expect(await codes(author, id)).toEqual(["PT-BR", "EN*"]);
    await renameLanguage(author, id, pt, "Portuguese");
    expect((await getBookHeader(author, id)).languages[0]?.name).toBe("Portuguese");
  });

  it("Change written-first: exactly one", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: pt } = await addLanguage(author, id, { code: "PT-BR", name: "Português" });
    await setWrittenFirst(author, id, pt);
    expect(await codes(author, id)).toEqual(["EN", "PT-BR*"]);
  });

  it("Invalid or duplicate code", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (const code of ["english", "E", "EN-", "EN_US", "12"])
      await rejects(() => addLanguage(author, id, { code, name: "X" }), ZodError);
    await rejects(
      () => addLanguage(author, id, { code: "en", name: "English" }),
      BookValidationError,
    );
    await rejects(() => addLanguage(author, id, { code: "FR", name: "" }), ZodError);
    expect(await codes(author, id)).toEqual(["EN*"]);
  });

  it("Language limit", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (const code of ["FR", "DE", "ES", "IT", "NL", "SV", "DA", "FI", "PL"])
      await addLanguage(author, id, { code, name: code });
    await rejects(() => addLanguage(author, id, { code: "PT", name: "PT" }), BookValidationError);
  });

  it("Remove the written-first language: refused", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const en = (await getBookHeader(author, id)).languages[0]?.id;
    await rejects(() => removeLanguage(author, id, en), BookValidationError);
    expect(await codes(author, id)).toEqual(["EN*"]);
  });

  it("Remove a language with titles: titles stripped, positions dense", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: pt } = await addLanguage(author, id, { code: "PT-BR", name: "Português" });
    await addLanguage(author, id, { code: "FR", name: "Français" });
    const { id: partId } = await createPart(author, id, { EN: "Book One", "PT-BR": "Livro Um" });
    await createChapter(author, id, {
      code: "01",
      titles: { EN: "Arrival", "PT-BR": "Chegada" },
      partId,
    });
    const { lines } = captureLogs();
    await removeLanguage(author, id, pt);
    expect(await codes(author, id)).toEqual(["EN*", "FR"]);
    const outline = await getOutline(author, id);
    expect(outline.parts[0]?.titles).toEqual({ EN: "Book One" });
    expect(outline.parts[0]?.chapters[0]?.titles).toEqual({ EN: "Arrival" });
    expect(lines.find((l) => l.event === "book.language.removed")).toMatchObject({
      code: "PT-BR",
      titlesStripped: 2,
    });
    // Positions stay dense: moving FR up now swaps it with EN.
    const fr = (await getBookHeader(author, id)).languages[1]?.id;
    await moveLanguage(author, id, fr, "up");
    expect(await codes(author, id)).toEqual(["FR", "EN*"]);
  });
});
