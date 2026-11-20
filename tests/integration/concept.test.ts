import { beforeEach, describe, expect, it } from "vitest";
import { getConcept, saveConcept } from "@/server/books/concept";
import { Conflict } from "@/server/books/core";
import { RichTextError, plainText } from "@/shared/rich-text";
import { captureLogs } from "../helpers";
import { makeAuthor, makeBook, rejects, resetBooks } from "./book-helpers";

const doc = (text: string) => ({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Concept" }] },
    { type: "paragraph", content: [{ type: "text", text }] },
  ],
});

describe("book-profile: Concept autosaves without overwriting newer text", () => {
  beforeEach(resetBooks);

  it("Autosave: saves, increments the version, reads back", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { lines } = captureLogs();
    expect(await saveConcept(author, id, doc("first"), 1)).toEqual({ version: 2 });
    expect(await saveConcept(author, id, JSON.stringify(doc("second")), 2)).toEqual({ version: 3 });
    const c = await getConcept(author, id);
    expect(plainText(c.body)).toBe("Concept\n\nsecond");
    expect(c.version).toBe(3);
    expect(lines.find((l) => l.event === "concept.saved")).toMatchObject({
      bookId: id,
      version: 2,
      chars: "Conceptfirst".length,
      ms: expect.any(Number),
    });
  });

  it("Conflict: a stale version is refused and the stored text kept", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await saveConcept(author, id, doc("tab A"), 1);
    const { lines } = captureLogs();
    await rejects(() => saveConcept(author, id, doc("tab B"), 1), Conflict);
    expect(plainText((await getConcept(author, id)).body)).toContain("tab A");
    expect(lines.find((l) => l.event === "book.conflict")).toMatchObject({ target: "concept" });
  });
});

describe("book-profile: Concept is rich text with a fixed set of formats", () => {
  beforeEach(resetBooks);

  it("Disallowed content and too large: refused, stored Concept unchanged", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await saveConcept(author, id, doc("kept"), 1);
    const { lines } = captureLogs();
    for (const bad of [
      { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [{ type: "link", attrs: { href: "javascript:x" } }],
              },
            ],
          },
        ],
      },
      "<p onclick=alert(1)>html</p>",
      doc("x".repeat(200_001)),
    ]) {
      await rejects(() => saveConcept(author, id, bad, 2), RichTextError);
    }
    const c = await getConcept(author, id);
    expect(c.version).toBe(2);
    expect(plainText(c.body)).toContain("kept");
    expect(lines.filter((l) => l.event === "concept.rejected").map((l) => l.reason)).toEqual([
      "schema",
      "schema",
      "schema",
      "size",
    ]);
  });
});
