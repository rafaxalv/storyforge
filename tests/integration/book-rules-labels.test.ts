import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import { getProfile, updateTruthLabels } from "@/server/books/books";
import { BookValidationError, Conflict } from "@/server/books/core";
import { addRule, moveRule, removeRule, updateRule } from "@/server/books/rules";
import { getDb } from "@/server/db/client";
import { standingRule } from "@/server/db/schema";
import { DEFAULT_TRUTH_LABELS } from "@/shared/books";
import { RichTextError, plainText, type RichDoc } from "@/shared/rich-text";
import { makeAuthor, makeBook, rejects, resetBooks } from "./book-helpers";

const rule = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text, marks: [{ type: "bold" }] }] }],
});

const ruleTexts = async (actor: Parameters<typeof getProfile>[0], id: string) =>
  (await getProfile(actor, id)).rules.map((r) => plainText(r.body as RichDoc));

describe("book-profile: Author can manage standing rules", () => {
  beforeEach(resetBooks);

  it("Add rules: numbered by order, dated, formatting kept", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await addRule(author, id, rule("No anachronisms"));
    await addRule(author, id, rule("Dates in full"));
    const p = await getProfile(author, id);
    expect(p.rules.map((r) => plainText(r.body as RichDoc))).toEqual([
      "No anachronisms",
      "Dates in full",
    ]);
    expect(p.rules[0]?.body).toEqual(rule("No anachronisms"));
    expect(p.rules[0]?.updatedAt).toBeInstanceOf(Date);
  });

  it("Reorder renumbers; delete keeps the rest in order", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: a } = await addRule(author, id, rule("A"));
    const { id: b } = await addRule(author, id, rule("B"));
    await addRule(author, id, rule("C"));
    await moveRule(author, id, b, "up");
    expect(await ruleTexts(author, id)).toEqual(["B", "A", "C"]);
    await removeRule(author, id, a);
    expect(await ruleTexts(author, id)).toEqual(["B", "C"]);
    const positions = (
      await getDb()
        .select({ p: standingRule.position })
        .from(standingRule)
        .where(eq(standingRule.bookId, id))
    ).map((r) => r.p);
    expect(positions.sort()).toEqual([0, 1]);
  });

  it("Edit updates the date and the text", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const { id: r } = await addRule(author, id, rule("Old"));
    await getDb()
      .update(standingRule)
      .set({ updatedAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(standingRule.id, r));
    await updateRule(author, id, r, rule("New"));
    const [after] = (await getProfile(author, id)).rules;
    expect(plainText(after?.body as RichDoc)).toBe("New");
    expect(after?.updatedAt.getTime()).toBeGreaterThan(new Date("2026-01-02").getTime());
  });

  it("Rejects empty, oversized or disallowed rule bodies", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await rejects(() => addRule(author, id, { type: "doc", content: [] }), RichTextError);
    await rejects(() => addRule(author, id, rule("x".repeat(10_001))), RichTextError);
    await rejects(
      () =>
        addRule(author, id, {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "x", marks: [{ type: "link" }] }],
            },
          ],
        }),
      RichTextError,
    );
    expect((await getProfile(author, id)).rules).toEqual([]);
  });

  it("Rule limit", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await getDb()
      .insert(standingRule)
      .values(
        Array.from({ length: 100 }, (_, i) => ({
          bookId: id,
          body: rule(`r${i}`) as RichDoc,
          position: i,
        })),
      );
    await rejects(() => addRule(author, id, rule("one more")), BookValidationError);
  });
});

describe("book-profile: Author can manage truth labels", () => {
  beforeEach(resetBooks);

  it("Edit labels: add, move to the top, remove", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    const labels = ["RUMOUR", ...DEFAULT_TRUTH_LABELS.filter((l) => l !== "FICTIONAL")];
    await updateTruthLabels(author, id, labels, 1);
    expect((await getProfile(author, id)).truthLabels).toEqual(labels);
  });

  it("Last label, duplicates, length and count are refused", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    for (const bad of [
      [],
      ["A", "a"],
      [""],
      ["x".repeat(61)],
      Array.from({ length: 21 }, (_, i) => `L${i}`),
    ])
      await rejects(() => updateTruthLabels(author, id, bad, 1), ZodError);
    expect((await getProfile(author, id)).truthLabels).toEqual([...DEFAULT_TRUTH_LABELS]);
  });

  it("Reset restores the defaults; stale versions conflict", async () => {
    const author = await makeAuthor();
    const id = await makeBook(author);
    await updateTruthLabels(author, id, ["ONLY"], 1);
    await rejects(() => updateTruthLabels(author, id, ["OTHER"], 1), Conflict);
    await updateTruthLabels(author, id, null, 2, { reset: true });
    expect((await getProfile(author, id)).truthLabels).toEqual([...DEFAULT_TRUTH_LABELS]);
  });
});
