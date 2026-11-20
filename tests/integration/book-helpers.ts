import { sql } from "drizzle-orm";
import type { Actor } from "@/server/auth/actor";
import { createBook } from "@/server/books/books";
import { getDb } from "@/server/db/client";
import { user } from "@/server/db/schema";

/**
 * Book tests mostly don't need a real session: domain functions take an `actor`, so an
 * author row plus an Actor object is enough. `books-access.test.ts` uses real sign-ins.
 */
export async function makeAuthor(name = "Author"): Promise<Actor> {
  const id = crypto.randomUUID();
  const email = `${name.toLowerCase()}-${id}@example.com`;
  await getDb().insert(user).values({ id, name, email, emailVerified: true });
  return { userId: id, email, name, role: "user" };
}

export async function resetBooks(): Promise<void> {
  await getDb().execute(sql`TRUNCATE "book" CASCADE`);
}

/** A book with EN written-first (and optionally more languages added by the caller). */
export async function makeBook(actor: Actor, title = "The Crossing"): Promise<string> {
  const { id } = await createBook(actor, {
    title,
    languageCode: "EN",
    languageName: "English",
  });
  return id;
}

/** Expects `fn` to throw an error of class `cls`; returns it. */
export async function rejects<T extends Error>(
  fn: () => Promise<unknown>,
  cls: new (...args: never[]) => T,
): Promise<T> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof cls) return err;
    throw new Error(`expected ${cls.name}, got ${String(err)}`);
  }
  throw new Error(`expected ${cls.name}, nothing thrown`);
}
