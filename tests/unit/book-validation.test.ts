import { describe, expect, it } from "vitest";
import {
  LanguageCode,
  NewBook,
  Profile,
  TruthLabels,
  cleanTitles,
  moveWithin,
} from "@/shared/books";

const langs = [
  { code: "EN", writtenFirst: true },
  { code: "PT-BR", writtenFirst: false },
];

describe("book-profile: field rules", () => {
  it("Invalid title", () => {
    for (const title of ["", "  ", "x".repeat(201)])
      expect(
        NewBook.safeParse({ title, languageCode: "EN", languageName: "English" }).success,
      ).toBe(false);
    expect(NewBook.parse({ title: " A ", languageCode: "en", languageName: " English " })).toEqual({
      title: "A",
      languageCode: "EN",
      languageName: "English",
    });
  });

  it("language codes: normalized, format enforced", () => {
    expect(LanguageCode.parse(" pt-br ")).toBe("PT-BR");
    for (const bad of ["english", "E", "EN-", "EN_US", "12", "EN-USA"])
      expect(LanguageCode.safeParse(bad).success).toBe(false);
  });

  it("Target above limit; word counts are whole numbers in range; empty means none", () => {
    const base = { title: "T", oneLiner: "", peopleNotes: "" };
    expect(
      Profile.safeParse({ ...base, lengthTarget: "100000", lengthLimit: "90000" }).success,
    ).toBe(false);
    expect(Profile.parse({ ...base, lengthTarget: "", lengthLimit: "90000" })).toMatchObject({
      lengthTarget: null,
      lengthLimit: 90000,
    });
    for (const bad of ["0", "-5", "1.5", "abc", "2000001"])
      expect(Profile.safeParse({ ...base, lengthTarget: bad, lengthLimit: "" }).success).toBe(
        false,
      );
  });

  it("truth labels: 1–20, unique ignoring case, 1–60 chars", () => {
    expect(TruthLabels.parse([" A ", "B"])).toEqual(["A", "B"]);
    for (const bad of [
      [],
      ["A", "a"],
      [""],
      ["x".repeat(61)],
      Array.from({ length: 21 }, (_, i) => `L${i}`),
    ])
      expect(TruthLabels.safeParse(bad).success).toBe(false);
  });
});

describe("book-structure: titles per language", () => {
  it("keeps book languages, drops empty optional titles, requires written-first", () => {
    expect(cleanTitles({ EN: " Arrival ", "PT-BR": "" }, langs)).toEqual({
      ok: true,
      titles: { EN: "Arrival" },
    });
    expect(cleanTitles({ "PT-BR": "Chegada" }, langs)).toMatchObject({
      ok: false,
      error: "Enter the EN title",
    });
    expect(cleanTitles({ EN: "A", FR: "B" }, langs)).toMatchObject({ ok: false });
    expect(cleanTitles({ EN: "x".repeat(201) }, langs)).toMatchObject({ ok: false });
    expect(cleanTitles({ EN: 5 }, langs)).toMatchObject({ ok: false });
    expect(cleanTitles("Arrival", langs)).toMatchObject({ ok: false });
  });

  it("moveWithin swaps neighbours and refuses edges", () => {
    expect(moveWithin(["a", "b", "c"], "c", "up")).toEqual(["a", "c", "b"]);
    expect(moveWithin(["a", "b", "c"], "a", "down")).toEqual(["b", "a", "c"]);
    expect(moveWithin(["a", "b"], "a", "up")).toBeNull();
    expect(moveWithin(["a", "b"], "b", "down")).toBeNull();
    expect(moveWithin(["a"], "z", "up")).toBeNull();
  });
});
