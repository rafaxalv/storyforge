/**
 * Parts and chapters. Positions are dense among active rows of a list (the book's parts;
 * the chapters of one part, or of "no part"). No function here ever changes a chapter code.
 */
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { ChapterCode, LIMITS, MoveDirection, cleanTitles, moveWithin } from "@/shared/books";
import { suggestNextCode } from "@/shared/id-scheme";
import { NotFound, type Actor } from "../auth/actor";
import { getDb } from "../db/client";
import { chapter, part, type Titles } from "../db/schema";
import {
  BookValidationError,
  booksLog,
  checkLimit,
  idOf,
  isUniqueViolation,
  languagesOf,
  ownedBook,
  withBook,
  writeOrder,
  type Db,
  type Tx,
  dbNow,
} from "./core";

async function titlesFor(tx: Tx, bookId: string, input: unknown): Promise<Titles> {
  const result = cleanTitles(input, await languagesOf(tx, bookId));
  if (!result.ok) throw new BookValidationError(result.error, "titles");
  return result.titles;
}

const activePartIds = async (db: Db, bookId: string) =>
  (
    await db
      .select({ id: part.id })
      .from(part)
      .where(and(eq(part.bookId, bookId), isNull(part.removedAt)))
      .orderBy(asc(part.position))
  ).map((r) => r.id);

const activeChapterIds = async (db: Db, bookId: string, partId: string | null) =>
  (
    await db
      .select({ id: chapter.id })
      .from(chapter)
      .where(
        and(
          eq(chapter.bookId, bookId),
          partId ? eq(chapter.partId, partId) : isNull(chapter.partId),
          isNull(chapter.removedAt),
        ),
      )
      .orderBy(asc(chapter.position))
  ).map((r) => r.id);

async function partIn(tx: Tx, bookId: string, partId: unknown) {
  const [row] = await tx
    .select()
    .from(part)
    .where(and(eq(part.id, idOf(partId)), eq(part.bookId, bookId)));
  if (!row) throw new NotFound();
  return row;
}

async function chapterIn(tx: Tx, bookId: string, chapterId: unknown) {
  const [row] = await tx
    .select()
    .from(chapter)
    .where(and(eq(chapter.id, idOf(chapterId)), eq(chapter.bookId, bookId)));
  if (!row) throw new NotFound();
  return row;
}

/** "" / null / undefined → no part; otherwise an active part of this book. */
async function targetPart(tx: Tx, bookId: string, partId: unknown): Promise<string | null> {
  if (partId === "" || partId === null || partId === undefined) return null;
  const p = await partIn(tx, bookId, partId);
  if (p.removedAt) throw new NotFound();
  return p.id;
}

// ---------------------------------------------------------------- parts

export async function createPart(
  actor: Actor,
  bookId: unknown,
  titles: unknown,
): Promise<{ id: string }> {
  return withBook(actor, bookId, "books.createPart", async (tx, owned) => {
    const clean = await titlesFor(tx, owned.id, titles);
    const [n] = await tx.select({ n: count() }).from(part).where(eq(part.bookId, owned.id));
    checkLimit(n?.n ?? 0, LIMITS.parts, "parts", "parts");
    const position = (await activePartIds(tx, owned.id)).length;
    const [row] = await tx
      .insert(part)
      .values({ bookId: owned.id, titles: clean, position })
      .returning({ id: part.id });
    if (!row) throw new Error("part insert returned nothing");
    booksLog().info(
      { event: "part.created", userId: actor.userId, bookId: owned.id, partId: row.id },
      "part created",
    );
    return row;
  });
}

export async function renamePart(
  actor: Actor,
  bookId: unknown,
  partId: unknown,
  titles: unknown,
): Promise<void> {
  await withBook(actor, bookId, "books.renamePart", async (tx, owned) => {
    const p = await partIn(tx, owned.id, partId);
    await tx
      .update(part)
      .set({ titles: await titlesFor(tx, owned.id, titles) })
      .where(eq(part.id, p.id));
    booksLog().info(
      { event: "part.renamed", userId: actor.userId, bookId: owned.id, partId: p.id },
      "part renamed",
    );
  });
}

export async function movePart(
  actor: Actor,
  bookId: unknown,
  partId: unknown,
  direction: unknown,
): Promise<void> {
  const dir = MoveDirection.parse(direction);
  await withBook(actor, bookId, "books.movePart", async (tx, owned) => {
    const p = await partIn(tx, owned.id, partId);
    const order = moveWithin(await activePartIds(tx, owned.id), p.id, dir);
    if (!order) return;
    await writeOrder(tx, part, order);
    booksLog().info(
      {
        event: "part.moved",
        userId: actor.userId,
        bookId: owned.id,
        partId: p.id,
        position: order.indexOf(p.id),
      },
      "part moved",
    );
  });
}

/** Removes an empty part (restorable). A part with active chapters can't be removed. */
export async function removePart(actor: Actor, bookId: unknown, partId: unknown): Promise<void> {
  await withBook(actor, bookId, "books.removePart", async (tx, owned) => {
    const p = await partIn(tx, owned.id, partId);
    if (p.removedAt) return;
    const active = (await activeChapterIds(tx, owned.id, p.id)).length;
    if (active > 0) {
      booksLog().warn(
        {
          event: "part.remove.refused",
          userId: actor.userId,
          bookId: owned.id,
          partId: p.id,
          activeChapters: active,
        },
        "part still has chapters",
      );
      throw new BookValidationError("Move or remove this part's chapters first.");
    }
    await tx.update(part).set({ removedAt: dbNow() }).where(eq(part.id, p.id));
    await writeOrder(tx, part, await activePartIds(tx, owned.id));
    booksLog().info(
      { event: "part.removed", userId: actor.userId, bookId: owned.id, partId: p.id },
      "part removed",
    );
  });
}

export async function restorePart(actor: Actor, bookId: unknown, partId: unknown): Promise<void> {
  await withBook(actor, bookId, "books.restorePart", async (tx, owned) => {
    const p = await partIn(tx, owned.id, partId);
    if (!p.removedAt) return;
    const position = (await activePartIds(tx, owned.id)).length;
    await tx.update(part).set({ removedAt: null, position }).where(eq(part.id, p.id));
    booksLog().info(
      { event: "part.restored", userId: actor.userId, bookId: owned.id, partId: p.id },
      "part restored",
    );
  });
}

// ---------------------------------------------------------------- chapters

export async function createChapter(
  actor: Actor,
  bookId: unknown,
  input: { code: unknown; titles: unknown; partId?: unknown },
): Promise<{ id: string }> {
  const code = ChapterCode.parse(input.code);
  return withBook(actor, bookId, "books.createChapter", async (tx, owned) => {
    const titles = await titlesFor(tx, owned.id, input.titles);
    const partId = await targetPart(tx, owned.id, input.partId);
    const [n] = await tx.select({ n: count() }).from(chapter).where(eq(chapter.bookId, owned.id));
    checkLimit(n?.n ?? 0, LIMITS.chapters, "chapters", "chapters");
    const position = (await activeChapterIds(tx, owned.id, partId)).length;
    try {
      const [row] = await tx
        .insert(chapter)
        .values({ bookId: owned.id, partId, code, titles, position })
        .returning({ id: chapter.id });
      if (!row) throw new Error("chapter insert returned nothing");
      booksLog().info(
        {
          event: "chapter.created",
          userId: actor.userId,
          bookId: owned.id,
          chapterId: row.id,
          code,
          partId,
        },
        "chapter created",
      );
      return row;
    } catch (err) {
      if (isUniqueViolation(err, "chapter_code_uq"))
        throw new BookValidationError(`Code ${code} is already used in this book.`, "code");
      throw err;
    }
  });
}

export async function renameChapter(
  actor: Actor,
  bookId: unknown,
  chapterId: unknown,
  titles: unknown,
): Promise<void> {
  await withBook(actor, bookId, "books.renameChapter", async (tx, owned) => {
    const c = await chapterIn(tx, owned.id, chapterId);
    await tx
      .update(chapter)
      .set({ titles: await titlesFor(tx, owned.id, titles) })
      .where(eq(chapter.id, c.id));
    booksLog().info(
      {
        event: "chapter.renamed",
        userId: actor.userId,
        bookId: owned.id,
        chapterId: c.id,
        code: c.code,
      },
      "chapter renamed",
    );
  });
}

export async function moveChapter(
  actor: Actor,
  bookId: unknown,
  chapterId: unknown,
  direction: unknown,
): Promise<void> {
  const dir = MoveDirection.parse(direction);
  await withBook(actor, bookId, "books.moveChapter", async (tx, owned) => {
    const c = await chapterIn(tx, owned.id, chapterId);
    if (c.removedAt) throw new NotFound();
    const order = moveWithin(await activeChapterIds(tx, owned.id, c.partId), c.id, dir);
    if (!order) return;
    await writeOrder(tx, chapter, order);
    booksLog().info(
      {
        event: "chapter.moved",
        userId: actor.userId,
        bookId: owned.id,
        chapterId: c.id,
        code: c.code,
        fromPartId: c.partId,
        toPartId: c.partId,
        position: order.indexOf(c.id),
      },
      "chapter moved",
    );
  });
}

/** Moves a chapter to the end of another part ("" / null = no part). */
export async function moveChapterToPart(
  actor: Actor,
  bookId: unknown,
  chapterId: unknown,
  partId: unknown,
): Promise<void> {
  await withBook(actor, bookId, "books.moveChapterToPart", async (tx, owned) => {
    const c = await chapterIn(tx, owned.id, chapterId);
    if (c.removedAt) throw new NotFound();
    const target = await targetPart(tx, owned.id, partId);
    if (target === c.partId) return;
    const position = (await activeChapterIds(tx, owned.id, target)).length;
    await tx.update(chapter).set({ partId: target, position }).where(eq(chapter.id, c.id));
    await writeOrder(tx, chapter, await activeChapterIds(tx, owned.id, c.partId));
    booksLog().info(
      {
        event: "chapter.moved",
        userId: actor.userId,
        bookId: owned.id,
        chapterId: c.id,
        code: c.code,
        fromPartId: c.partId,
        toPartId: target,
        position,
      },
      "chapter moved to another part",
    );
  });
}

export async function removeChapter(
  actor: Actor,
  bookId: unknown,
  chapterId: unknown,
): Promise<void> {
  await withBook(actor, bookId, "books.removeChapter", async (tx, owned) => {
    const c = await chapterIn(tx, owned.id, chapterId);
    if (c.removedAt) return;
    await tx.update(chapter).set({ removedAt: dbNow() }).where(eq(chapter.id, c.id));
    await writeOrder(tx, chapter, await activeChapterIds(tx, owned.id, c.partId));
    booksLog().info(
      {
        event: "chapter.removed",
        userId: actor.userId,
        bookId: owned.id,
        chapterId: c.id,
        code: c.code,
      },
      "chapter removed",
    );
  });
}

/** Restores a chapter at the end of its part, or of "no part" if its part is removed. */
export async function restoreChapter(
  actor: Actor,
  bookId: unknown,
  chapterId: unknown,
): Promise<void> {
  await withBook(actor, bookId, "books.restoreChapter", async (tx, owned) => {
    const c = await chapterIn(tx, owned.id, chapterId);
    if (!c.removedAt) return;
    let partId = c.partId;
    if (partId) {
      const [p] = await tx
        .select({ removedAt: part.removedAt })
        .from(part)
        .where(eq(part.id, partId));
      if (!p || p.removedAt) partId = null;
    }
    const position = (await activeChapterIds(tx, owned.id, partId)).length;
    await tx.update(chapter).set({ removedAt: null, partId, position }).where(eq(chapter.id, c.id));
    booksLog().info(
      {
        event: "chapter.restored",
        userId: actor.userId,
        bookId: owned.id,
        chapterId: c.id,
        code: c.code,
        partId,
      },
      "chapter restored",
    );
  });
}

// ---------------------------------------------------------------- outline

export interface OutlineChapter {
  id: string;
  code: string;
  titles: Titles;
  partId: string | null;
}

export interface OutlinePart {
  id: string;
  titles: Titles;
  chapters: OutlineChapter[];
}

export interface Outline {
  languages: { id: string; code: string; name: string; writtenFirst: boolean }[];
  parts: OutlinePart[];
  unparted: OutlineChapter[];
  removedParts: { id: string; titles: Titles }[];
  removedChapters: OutlineChapter[];
  suggestedCode: string | null;
}

export async function getOutline(actor: Actor, bookId: unknown): Promise<Outline> {
  const owned = await ownedBook(actor, bookId, "books.getOutline");
  const db = getDb();
  const [languages, parts, chapters] = await Promise.all([
    languagesOf(db, owned.id),
    db
      .select({ id: part.id, titles: part.titles, removedAt: part.removedAt })
      .from(part)
      .where(eq(part.bookId, owned.id))
      .orderBy(asc(part.position)),
    db
      .select({
        id: chapter.id,
        code: chapter.code,
        titles: chapter.titles,
        partId: chapter.partId,
        removedAt: chapter.removedAt,
      })
      .from(chapter)
      .where(eq(chapter.bookId, owned.id))
      .orderBy(asc(chapter.position), asc(chapter.code)),
  ]);
  const activeParts = new Set(parts.filter((p) => !p.removedAt).map((p) => p.id));
  const view = ({ id, code, titles, partId }: (typeof chapters)[number]): OutlineChapter => ({
    id,
    code,
    titles,
    partId,
  });
  return {
    languages,
    parts: parts
      .filter((p) => !p.removedAt)
      .map((p) => ({
        id: p.id,
        titles: p.titles,
        chapters: chapters.filter((c) => !c.removedAt && c.partId === p.id).map(view),
      })),
    unparted: chapters
      .filter((c) => !c.removedAt && (c.partId === null || !activeParts.has(c.partId)))
      .map(view),
    removedParts: parts.filter((p) => p.removedAt).map((p) => ({ id: p.id, titles: p.titles })),
    removedChapters: chapters.filter((c) => c.removedAt).map(view),
    suggestedCode: suggestNextCode(chapters.map((c) => c.code)),
  };
}
