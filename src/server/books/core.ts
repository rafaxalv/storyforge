/**
 * Shared plumbing of the books module: the ownership check every function starts with,
 * errors, transactions, list ordering and logging.
 */
import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { NotFound, requireOwner, type Actor } from "../auth/actor";
import { getDb, type Database } from "../db/client";
import { book, bookLanguage } from "../db/schema";
import { log } from "../log";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Db = Database | Tx;

export const booksLog = () => log("books");

/** A rule of the book was broken (bad input, a limit, a refused removal); safe to show. */
export class BookValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "BookValidationError";
  }
}

/** The row changed since the author loaded it. */
export class Conflict extends Error {
  constructor(public readonly target: "profile" | "labels" | "concept") {
    super("This changed elsewhere. Reload to see the latest version.");
    this.name = "Conflict";
  }
}

const Uuid = z.uuid();

/** Parses an id from the client; anything that is not a uuid is simply "not found". */
export function idOf(value: unknown): string {
  const parsed = Uuid.safeParse(value);
  if (!parsed.success) throw new NotFound();
  return parsed.data;
}

export interface OwnedBook {
  id: string;
  ownerId: string;
  title: string;
  version: number;
}

/**
 * The ownership check: the book must exist and belong to the actor. Missing, malformed and
 * foreign ids all end as "not found" for the client. With `lock`, the book row is locked
 * for the rest of the transaction, which serializes structure edits per book.
 */
export async function ownedBook(
  actor: Actor,
  bookId: unknown,
  op: string,
  opts: { tx?: Db; lock?: boolean } = {},
): Promise<OwnedBook> {
  const id = Uuid.safeParse(bookId);
  const db = opts.tx ?? getDb();
  const query = id.success
    ? db
        .select({ id: book.id, ownerId: book.ownerId, title: book.title, version: book.version })
        .from(book)
        .where(eq(book.id, id.data))
    : null;
  const [row] = query ? await (opts.lock ? query.for("update") : query) : [];
  if (!row) {
    log("access").warn(
      { event: "access.denied", userId: actor.userId, reason: "not-found", op },
      "no such book",
    );
    throw new NotFound();
  }
  requireOwner(actor, row.ownerId, op);
  return row;
}

/** The database's clock: every timestamp comes from one clock (the app's may drift). */
export const dbNow = () => sql<Date>`now()`;

/** Runs `fn` in a transaction after locking the actor's book. */
export function withBook<T>(
  actor: Actor,
  bookId: unknown,
  op: string,
  fn: (tx: Tx, owned: OwnedBook) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    const owned = await ownedBook(actor, bookId, op, { tx, lock: true });
    const result = await fn(tx, owned);
    await tx.update(book).set({ updatedAt: dbNow() }).where(eq(book.id, owned.id));
    return result;
  });
}

/** The book's languages in order. */
export function languagesOf(db: Db, bookId: string) {
  return db
    .select({
      id: bookLanguage.id,
      code: bookLanguage.code,
      name: bookLanguage.name,
      writtenFirst: bookLanguage.writtenFirst,
    })
    .from(bookLanguage)
    .where(eq(bookLanguage.bookId, bookId))
    .orderBy(bookLanguage.position);
}

/** Writes positions 0..n-1 in the given order (one statement). */
export async function writeOrder(tx: Db, table: PgTable, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const values = sql.join(
    ids.map((id, i) => sql`(${id}::uuid, ${i}::int)`),
    sql`, `,
  );
  await tx.execute(
    sql`UPDATE ${table} AS t SET position = v.pos FROM (VALUES ${values}) AS v(id, pos) WHERE t.id = v.id AND t.position IS DISTINCT FROM v.pos`,
  );
}

/** Fails with a form message when `count` already reached `limit`. */
export function checkLimit(count: number, limit: number, kind: string, what: string): void {
  if (count >= limit) {
    booksLog().warn({ event: "book.limit", kind, limit }, "limit reached");
    throw new BookValidationError(`A book can have at most ${limit} ${what}.`);
  }
}

/** True for a Postgres unique violation on the named index. */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    if (
      typeof e === "object" &&
      (e as { code?: unknown }).code === "23505" &&
      (e as { constraint?: unknown }).constraint === constraint
    )
      return true;
  }
  return false;
}
