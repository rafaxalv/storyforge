/** The Concept: one rich-text document per book, saved with a version check. */
import { and, eq, sql } from "drizzle-orm";
import {
  CONCEPT_MAX_CHARS,
  RichTextError,
  parseRichText,
  textLength,
  type RichDoc,
} from "@/shared/rich-text";
import type { Actor } from "../auth/actor";
import { getDb } from "../db/client";
import { book, concept } from "../db/schema";
import { Conflict, Version, booksLog, dbNow, ownedBook } from "./core";

export interface ConceptDoc {
  body: RichDoc;
  version: number;
  updatedAt: Date;
}

export async function getConcept(actor: Actor, bookId: unknown): Promise<ConceptDoc> {
  const owned = await ownedBook(actor, bookId, "books.getConcept");
  const [row] = await getDb()
    .select({ body: concept.body, version: concept.version, updatedAt: concept.updatedAt })
    .from(concept)
    .where(eq(concept.bookId, owned.id));
  if (!row) throw new Error("book without a concept row");
  return row;
}

/** Saves the Concept if it is still at `version`; returns the new version. */
export async function saveConcept(
  actor: Actor,
  bookId: unknown,
  body: unknown,
  version: number,
): Promise<{ version: number }> {
  const started = performance.now();
  const owned = await ownedBook(actor, bookId, "books.saveConcept");
  const expected = Version.parse(version);
  let doc: RichDoc;
  try {
    doc = parseRichText(body, { maxChars: CONCEPT_MAX_CHARS });
  } catch (err) {
    if (err instanceof RichTextError)
      booksLog().warn(
        { event: "concept.rejected", userId: actor.userId, bookId: owned.id, reason: err.reason },
        "concept rejected",
      );
    throw err;
  }
  const now = dbNow();
  const row = await getDb().transaction(async (tx) => {
    const [saved] = await tx
      .update(concept)
      .set({ body: doc, version: sql`${concept.version} + 1`, updatedAt: now })
      .where(and(eq(concept.bookId, owned.id), eq(concept.version, expected)))
      .returning({ version: concept.version });
    if (saved) await tx.update(book).set({ updatedAt: now }).where(eq(book.id, owned.id));
    return saved;
  });
  if (!row) {
    booksLog().warn(
      {
        event: "book.conflict",
        userId: actor.userId,
        bookId: owned.id,
        target: "concept",
        expected,
      },
      "concept changed elsewhere",
    );
    throw new Conflict("concept");
  }
  booksLog().info(
    {
      event: "concept.saved",
      userId: actor.userId,
      bookId: owned.id,
      version: row.version,
      chars: textLength(doc),
      ms: Math.round(performance.now() - started),
    },
    "concept saved",
  );
  return row;
}
