import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { deleteAccount } from "@/server/account/account";
import { getActor } from "@/server/auth/actor";
import { createBook } from "@/server/books/books";
import { registerBooksPurge } from "@/server/books/purge";
import { createChapter } from "@/server/books/structure";
import { getDb } from "@/server/db/client";
import { book, chapter } from "@/server/db/schema";
import { clearPurgeStepsForTests, runPurge } from "@/server/jobs/purge";
import { closeQueue } from "@/server/jobs/queue";
import { captureLogs } from "../helpers";
import { signIn } from "./auth-helpers";
import { makeAuthor } from "./book-helpers";

afterEach(async () => {
  clearPurgeStepsForTests();
  await closeQueue();
});

describe("book-profile: Account deletion removes books", () => {
  it("deleting the account leaves no book rows; the books purge step runs clean", async () => {
    const { headers } = await signIn(`books-${crypto.randomUUID()}@example.com`);
    const me = await getActor(headers);
    const { id } = await createBook(me, {
      title: "Mine",
      languageCode: "EN",
      languageName: "English",
    });
    await createChapter(me, id, { code: "01", titles: { EN: "One" } });
    expect((await deleteAccount(headers, "DELETE")).ok).toBe(true);
    expect(await getDb().select().from(book).where(eq(book.ownerId, me.userId))).toEqual([]);
    expect(await getDb().select().from(chapter).where(eq(chapter.bookId, id))).toEqual([]);

    registerBooksPurge();
    const { lines } = captureLogs();
    expect(await runPurge(me.userId)).toBe(1);
    expect(lines.find((l) => l.event === "account.purge.step")).toMatchObject({
      step: "books",
      ok: true,
    });
    expect(lines.find((l) => l.event === "books.purged")).toMatchObject({ deleted: 0 });
  });

  it("the purge step removes leftover books of a user id", async () => {
    const author = await makeAuthor();
    await createBook(author, { title: "Left", languageCode: "EN", languageName: "English" });
    const { purgeBooks } = await import("@/server/books/books");
    expect(await purgeBooks(author.userId)).toBe(1);
    expect(await getDb().select().from(book).where(eq(book.ownerId, author.userId))).toEqual([]);
  });
});
