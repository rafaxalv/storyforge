import { beforeAll, describe, expect, it } from "vitest";
import { getActor, isNotFound, type Actor } from "@/server/auth/actor";
import {
  deleteBook,
  getBookHeader,
  getProfile,
  listBooks,
  updateProfile,
  updateTruthLabels,
} from "@/server/books/books";
import { getConcept, saveConcept } from "@/server/books/concept";
import {
  addLanguage,
  moveLanguage,
  removeLanguage,
  renameLanguage,
  setWrittenFirst,
} from "@/server/books/languages";
import { addRule, moveRule, removeRule, updateRule } from "@/server/books/rules";
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
import { captureLogs } from "../helpers";
import { resetAuthTables, twoUsers } from "./auth-helpers";

const rule = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "R" }] }],
};

/**
 * The E01 access pattern for books: a real signed-in second author calls every domain
 * function with the first author's ids → "not found", and nothing changes. Child ids from
 * another book of the same author are "not found" too.
 */
describe("book-profile: Books are private to their owner", () => {
  let alice: Actor;
  let bob: Actor;
  let book: string;
  let other: string; // a second book of Alice
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await resetAuthTables();
    const users = await twoUsers();
    [alice, bob] = await Promise.all([getActor(users.alice), getActor(users.bob)]);
    const { createBook } = await import("@/server/books/books");
    book = (
      await createBook(alice, { title: "Private", languageCode: "EN", languageName: "English" })
    ).id;
    other = (
      await createBook(alice, { title: "Other", languageCode: "EN", languageName: "English" })
    ).id;
    ids.lang = (await addLanguage(alice, book, { code: "FR", name: "Français" })).id;
    ids.rule = (await addRule(alice, book, rule)).id;
    ids.part = (await createPart(alice, book, { EN: "Part" })).id;
    ids.part2 = (await createPart(alice, book, { EN: "Part 2" })).id;
    ids.chapter = (
      await createChapter(alice, book, { code: "01", titles: { EN: "C" }, partId: ids.part })
    ).id;
    ids.removedPart = (await createPart(alice, book, { EN: "Gone" })).id;
    await removePart(alice, book, ids.removedPart);
    ids.removedChapter = (await createChapter(alice, book, { code: "02", titles: { EN: "D" } })).id;
    await removeChapter(alice, book, ids.removedChapter);
  });

  const snapshot = async () =>
    JSON.stringify([
      await getProfile(alice, book),
      await getOutline(alice, book),
      await getConcept(alice, book),
    ]);

  const calls = (who: () => Actor, b: () => string): [string, () => Promise<unknown>][] => [
    ["getBookHeader", () => getBookHeader(who(), b())],
    ["getProfile", () => getProfile(who(), b())],
    [
      "updateProfile",
      () =>
        updateProfile(
          who(),
          b(),
          { title: "Hacked", oneLiner: "", lengthTarget: "", lengthLimit: "", peopleNotes: "" },
          1,
        ),
    ],
    ["updateTruthLabels", () => updateTruthLabels(who(), b(), ["HACKED"], 1)],
    ["deleteBook", () => deleteBook(who(), b(), "Private")],
    ["getConcept", () => getConcept(who(), b())],
    ["saveConcept", () => saveConcept(who(), b(), rule, 1)],
    ["addLanguage", () => addLanguage(who(), b(), { code: "DE", name: "Deutsch" })],
    ["renameLanguage", () => renameLanguage(who(), b(), ids.lang, "Hacked")],
    ["moveLanguage", () => moveLanguage(who(), b(), ids.lang, "up")],
    ["setWrittenFirst", () => setWrittenFirst(who(), b(), ids.lang)],
    ["removeLanguage", () => removeLanguage(who(), b(), ids.lang)],
    ["addRule", () => addRule(who(), b(), rule)],
    ["updateRule", () => updateRule(who(), b(), ids.rule, rule)],
    ["moveRule", () => moveRule(who(), b(), ids.rule, "down")],
    ["removeRule", () => removeRule(who(), b(), ids.rule)],
    ["createPart", () => createPart(who(), b(), { EN: "Hacked" })],
    ["renamePart", () => renamePart(who(), b(), ids.part, { EN: "Hacked" })],
    ["movePart", () => movePart(who(), b(), ids.part, "down")],
    ["removePart", () => removePart(who(), b(), ids.part2)],
    ["restorePart", () => restorePart(who(), b(), ids.removedPart)],
    ["createChapter", () => createChapter(who(), b(), { code: "05", titles: { EN: "Hacked" } })],
    ["renameChapter", () => renameChapter(who(), b(), ids.chapter, { EN: "Hacked" })],
    ["moveChapter", () => moveChapter(who(), b(), ids.chapter, "down")],
    ["moveChapterToPart", () => moveChapterToPart(who(), b(), ids.chapter, ids.part2)],
    ["removeChapter", () => removeChapter(who(), b(), ids.chapter)],
    ["restoreChapter", () => restoreChapter(who(), b(), ids.removedChapter)],
    ["getOutline", () => getOutline(who(), b())],
  ];

  it("Another author's book: every function answers not found and nothing changes", async () => {
    const before = await snapshot();
    const { lines } = captureLogs();
    for (const [name, call] of calls(
      () => bob,
      () => book,
    )) {
      const err = await call().then(
        () => null,
        (e: unknown) => e,
      );
      expect(isNotFound(err), name).toBe(true);
    }
    expect(await snapshot()).toBe(before);
    expect(await listBooks(bob)).toEqual([]);
    const denied = lines.filter((l) => l.event === "access.denied");
    expect(denied.length).toBeGreaterThanOrEqual(
      calls(
        () => bob,
        () => book,
      ).length,
    );
    expect(denied.every((l) => l.userId === bob.userId && l.reason === "not-owner")).toBe(true);
    expect(JSON.stringify(denied)).not.toContain("Private");
  });

  it("Malformed and missing book ids: not found", async () => {
    for (const bad of ["not-a-uuid", "", null, 42, crypto.randomUUID(), "' OR 1=1 --"]) {
      for (const [name, call] of calls(
        () => alice,
        () => bad as string,
      ).slice(0, 3)) {
        const err = await call().then(
          () => null,
          (e: unknown) => e,
        );
        expect(isNotFound(err), `${name}(${String(bad)})`).toBe(true);
      }
    }
  });

  it("Child ids from another book are not found, even for the same author", async () => {
    const before = await snapshot();
    const childCalls = calls(
      () => alice,
      () => other,
    ).filter(
      ([name]) =>
        /Language$|Rule$|Part$|Chapter$|ToPart$|WrittenFirst$/.test(name) &&
        !["addLanguage", "addRule", "createPart", "createChapter"].includes(name),
    );
    expect(childCalls.length).toBe(16);
    for (const [name, call] of childCalls) {
      const err = await call().then(
        () => null,
        (e: unknown) => e,
      );
      expect(isNotFound(err), name).toBe(true);
    }
    expect(await snapshot()).toBe(before);
  });
});
