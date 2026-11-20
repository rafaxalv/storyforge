/** Book languages: add, rename, reorder, set written-first, remove (strips titles). */
import { and, count, eq, sql } from "drizzle-orm";
import { LIMITS, LanguageCode, LanguageName, MoveDirection, moveWithin } from "@/shared/books";
import type { Actor } from "../auth/actor";
import { NotFound } from "../auth/actor";
import { bookLanguage, chapter, part } from "../db/schema";
import {
  BookValidationError,
  booksLog,
  checkLimit,
  idOf,
  isUniqueViolation,
  languagesOf,
  withBook,
  writeOrder,
  type Tx,
} from "./core";

async function languageIn(tx: Tx, bookId: string, languageId: unknown) {
  const id = idOf(languageId);
  const [row] = await tx
    .select()
    .from(bookLanguage)
    .where(and(eq(bookLanguage.id, id), eq(bookLanguage.bookId, bookId)));
  if (!row) throw new NotFound();
  return row;
}

export async function addLanguage(
  actor: Actor,
  bookId: unknown,
  input: { code: unknown; name: unknown },
): Promise<{ id: string }> {
  const code = LanguageCode.parse(input.code);
  const name = LanguageName.parse(input.name);
  return withBook(actor, bookId, "books.addLanguage", async (tx, owned) => {
    const [n] = await tx
      .select({ n: count() })
      .from(bookLanguage)
      .where(eq(bookLanguage.bookId, owned.id));
    checkLimit(n?.n ?? 0, LIMITS.languages, "languages", "languages");
    try {
      const [row] = await tx
        .insert(bookLanguage)
        .values({ bookId: owned.id, code, name, position: n?.n ?? 0 })
        .returning({ id: bookLanguage.id });
      if (!row) throw new Error("language insert returned nothing");
      booksLog().info(
        { event: "book.language.added", userId: actor.userId, bookId: owned.id, code },
        "language added",
      );
      return row;
    } catch (err) {
      if (isUniqueViolation(err, "book_language_code_uq"))
        throw new BookValidationError(`This book already has ${code}.`, "code");
      throw err;
    }
  });
}

export async function renameLanguage(
  actor: Actor,
  bookId: unknown,
  languageId: unknown,
  name: unknown,
): Promise<void> {
  const clean = LanguageName.parse(name);
  await withBook(actor, bookId, "books.renameLanguage", async (tx, owned) => {
    const lang = await languageIn(tx, owned.id, languageId);
    await tx.update(bookLanguage).set({ name: clean }).where(eq(bookLanguage.id, lang.id));
    booksLog().info(
      { event: "book.language.updated", userId: actor.userId, bookId: owned.id, code: lang.code },
      "language renamed",
    );
  });
}

export async function moveLanguage(
  actor: Actor,
  bookId: unknown,
  languageId: unknown,
  direction: unknown,
): Promise<void> {
  const dir = MoveDirection.parse(direction);
  await withBook(actor, bookId, "books.moveLanguage", async (tx, owned) => {
    const lang = await languageIn(tx, owned.id, languageId);
    const ids = (await languagesOf(tx, owned.id)).map((l) => l.id);
    const order = moveWithin(ids, lang.id, dir);
    if (!order) return;
    await writeOrder(tx, bookLanguage, order);
    booksLog().info(
      {
        event: "book.language.moved",
        userId: actor.userId,
        bookId: owned.id,
        code: lang.code,
        position: order.indexOf(lang.id),
      },
      "language moved",
    );
  });
}

export async function setWrittenFirst(
  actor: Actor,
  bookId: unknown,
  languageId: unknown,
): Promise<void> {
  await withBook(actor, bookId, "books.setWrittenFirst", async (tx, owned) => {
    const lang = await languageIn(tx, owned.id, languageId);
    if (lang.writtenFirst) return;
    await tx
      .update(bookLanguage)
      .set({ writtenFirst: false })
      .where(and(eq(bookLanguage.bookId, owned.id), eq(bookLanguage.writtenFirst, true)));
    await tx.update(bookLanguage).set({ writtenFirst: true }).where(eq(bookLanguage.id, lang.id));
    booksLog().info(
      {
        event: "book.language.updated",
        userId: actor.userId,
        bookId: owned.id,
        code: lang.code,
        writtenFirst: true,
      },
      "written-first language changed",
    );
  });
}

/** Removes a language (never the written-first one) and its part and chapter titles. */
export async function removeLanguage(
  actor: Actor,
  bookId: unknown,
  languageId: unknown,
): Promise<void> {
  await withBook(actor, bookId, "books.removeLanguage", async (tx, owned) => {
    const lang = await languageIn(tx, owned.id, languageId);
    if (lang.writtenFirst)
      throw new BookValidationError(
        "Pick another written-first language before removing this one.",
      );
    await tx.delete(bookLanguage).where(eq(bookLanguage.id, lang.id));
    const stripped = await Promise.all(
      [part, chapter].map((t) =>
        tx
          .update(t)
          .set({ titles: sql`${t.titles} - ${lang.code}::text` })
          .where(and(eq(t.bookId, owned.id), sql`jsonb_exists(${t.titles}, ${lang.code}::text)`))
          .returning({ id: t.id }),
      ),
    );
    await writeOrder(
      tx,
      bookLanguage,
      (await languagesOf(tx, owned.id)).map((l) => l.id),
    );
    booksLog().info(
      {
        event: "book.language.removed",
        userId: actor.userId,
        bookId: owned.id,
        code: lang.code,
        titlesStripped: stripped.reduce((n, rows) => n + rows.length, 0),
      },
      "language removed",
    );
  });
}
