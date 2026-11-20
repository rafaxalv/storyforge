/**
 * Books: create, list, read the header and profile, update the profile and truth labels,
 * delete. Every function takes the actor first and checks ownership (see core.ts).
 */
import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  DEFAULT_TRUTH_LABELS,
  LIMITS,
  NewBook,
  Profile,
  TruthLabels,
  type ProfileInput,
} from "@/shared/books";
import { emptyDoc } from "@/shared/rich-text";
import type { Actor } from "../auth/actor";
import { getDb } from "../db/client";
import { book, bookLanguage, concept, standingRule, user } from "../db/schema";
import { log } from "../log";
import { BookValidationError, Conflict, booksLog, languagesOf, ownedBook, dbNow } from "./core";

export interface BookSummary {
  id: string;
  title: string;
  oneLiner: string;
  updatedAt: Date;
}

/** Creates a book with one (written-first) language, default labels and an empty Concept. */
export async function createBook(actor: Actor, input: unknown): Promise<{ id: string }> {
  const { title, languageCode, languageName } = NewBook.parse(input);
  const id = await getDb().transaction(async (tx) => {
    // Lock the owner row so two creates can't both pass the limit.
    await tx.select({ id: user.id }).from(user).where(eq(user.id, actor.userId)).for("update");
    const [owned] = await tx
      .select({ n: count() })
      .from(book)
      .where(eq(book.ownerId, actor.userId));
    if ((owned?.n ?? 0) >= LIMITS.books) {
      booksLog().warn(
        { event: "book.limit", userId: actor.userId, kind: "books", limit: LIMITS.books },
        "limit reached",
      );
      throw new BookValidationError(`You can have at most ${LIMITS.books} books.`);
    }
    const [row] = await tx
      .insert(book)
      .values({ ownerId: actor.userId, title, truthLabels: [...DEFAULT_TRUTH_LABELS] })
      .returning({ id: book.id });
    if (!row) throw new Error("book insert returned nothing");
    await tx.insert(bookLanguage).values({
      bookId: row.id,
      code: languageCode,
      name: languageName,
      writtenFirst: true,
      position: 0,
    });
    await tx.insert(concept).values({ bookId: row.id, body: emptyDoc() });
    return row.id;
  });
  booksLog().info(
    { event: "book.created", userId: actor.userId, bookId: id, languageCode },
    "book created",
  );
  return { id };
}

/** The actor's books, most recently changed first. */
export function listBooks(actor: Actor): Promise<BookSummary[]> {
  return getDb()
    .select({ id: book.id, title: book.title, oneLiner: book.oneLiner, updatedAt: book.updatedAt })
    .from(book)
    .where(eq(book.ownerId, actor.userId))
    .orderBy(desc(book.updatedAt));
}

export interface BookHeader {
  id: string;
  title: string;
  languages: { id: string; code: string; name: string; writtenFirst: boolean }[];
}

/** Title and languages, for the book layout and forms. */
export async function getBookHeader(actor: Actor, bookId: unknown): Promise<BookHeader> {
  const owned = await ownedBook(actor, bookId, "books.getHeader");
  return { id: owned.id, title: owned.title, languages: await languagesOf(getDb(), owned.id) };
}

export interface BookProfile extends BookHeader {
  oneLiner: string;
  lengthTarget: number | null;
  lengthLimit: number | null;
  peopleNotes: string;
  truthLabels: string[];
  idScheme: string;
  version: number;
  rules: { id: string; body: unknown; updatedAt: Date }[];
}

export async function getProfile(actor: Actor, bookId: unknown): Promise<BookProfile> {
  const owned = await ownedBook(actor, bookId, "books.getProfile");
  const db = getDb();
  const [[row], languages, rules] = await Promise.all([
    db.select().from(book).where(eq(book.id, owned.id)),
    languagesOf(db, owned.id),
    db
      .select({ id: standingRule.id, body: standingRule.body, updatedAt: standingRule.updatedAt })
      .from(standingRule)
      .where(eq(standingRule.bookId, owned.id))
      .orderBy(standingRule.position),
  ]);
  if (!row) throw new BookValidationError("This book was just deleted.");
  return {
    id: row.id,
    title: row.title,
    languages,
    oneLiner: row.oneLiner,
    lengthTarget: row.lengthTarget,
    lengthLimit: row.lengthLimit,
    peopleNotes: row.peopleNotes,
    truthLabels: row.truthLabels,
    idScheme: row.idScheme,
    version: row.version,
    rules,
  };
}

const PROFILE_FIELDS = ["title", "oneLiner", "lengthTarget", "lengthLimit", "peopleNotes"] as const;

/** Versioned profile save: refused with Conflict when the book changed since `version`. */
export async function updateProfile(
  actor: Actor,
  bookId: unknown,
  input: unknown,
  version: number,
): Promise<{ version: number }> {
  const owned = await ownedBook(actor, bookId, "books.updateProfile");
  const profile: ProfileInput = Profile.parse(input);
  const [before] = await getDb().select().from(book).where(eq(book.id, owned.id));
  const [row] = await getDb()
    .update(book)
    .set({ ...profile, version: sql`${book.version} + 1`, updatedAt: dbNow() })
    .where(and(eq(book.id, owned.id), eq(book.version, version)))
    .returning({ version: book.version });
  if (!row) {
    booksLog().warn(
      {
        event: "book.conflict",
        userId: actor.userId,
        bookId: owned.id,
        target: "profile",
        expected: version,
      },
      "profile changed elsewhere",
    );
    throw new Conflict("profile");
  }
  const fields = PROFILE_FIELDS.filter((f) => before?.[f] !== profile[f]);
  booksLog().info(
    {
      event: "book.profile.updated",
      userId: actor.userId,
      bookId: owned.id,
      fields,
      version: row.version,
    },
    "profile updated",
  );
  return row;
}

/** Replaces the ordered truth-label list (versioned with the profile). */
export async function updateTruthLabels(
  actor: Actor,
  bookId: unknown,
  labels: unknown,
  version: number,
  opts: { reset?: boolean } = {},
): Promise<{ version: number }> {
  const owned = await ownedBook(actor, bookId, "books.updateTruthLabels");
  const clean = opts.reset ? [...DEFAULT_TRUTH_LABELS] : TruthLabels.parse(labels);
  const [row] = await getDb()
    .update(book)
    .set({ truthLabels: clean, version: sql`${book.version} + 1`, updatedAt: dbNow() })
    .where(and(eq(book.id, owned.id), eq(book.version, version)))
    .returning({ version: book.version });
  if (!row) {
    booksLog().warn(
      {
        event: "book.conflict",
        userId: actor.userId,
        bookId: owned.id,
        target: "labels",
        expected: version,
      },
      "labels changed elsewhere",
    );
    throw new Conflict("labels");
  }
  booksLog().info(
    {
      event: "book.labels.updated",
      userId: actor.userId,
      bookId: owned.id,
      count: clean.length,
      reset: Boolean(opts.reset),
    },
    "truth labels updated",
  );
  return row;
}

/** Deletes the book and everything in it; `typedTitle` must match the title exactly. */
export async function deleteBook(
  actor: Actor,
  bookId: unknown,
  typedTitle: unknown,
): Promise<void> {
  const owned = await ownedBook(actor, bookId, "books.delete");
  if (typeof typedTitle !== "string" || typedTitle.trim() !== owned.title) {
    booksLog().warn(
      {
        event: "book.delete.refused",
        userId: actor.userId,
        bookId: owned.id,
        reason: "confirmation",
      },
      "book deletion not confirmed",
    );
    throw new BookValidationError("Type the book's title exactly to delete it.", "confirmation");
  }
  await getDb()
    .delete(book)
    .where(and(eq(book.id, owned.id), eq(book.ownerId, actor.userId)));
  booksLog().info(
    { event: "book.deleted", userId: actor.userId, bookId: owned.id },
    "book deleted",
  );
}

/** Purge step: removes any book rows left for a deleted user (normally none; FK cascade). */
export async function purgeBooks(userId: string): Promise<number> {
  const rows = await getDb()
    .delete(book)
    .where(eq(book.ownerId, userId))
    .returning({ id: book.id });
  log("account").info({ event: "books.purged", userId, deleted: rows.length }, "books purged");
  return rows.length;
}
