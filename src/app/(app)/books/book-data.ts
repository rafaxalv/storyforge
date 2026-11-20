import { notFound } from "next/navigation";
import { cache } from "react";
import { isNotFound } from "@/server/auth/actor";
import { requirePageActor } from "@/server/auth/page-actor";
import { getBookHeader } from "@/server/books/books";
import type { Actor } from "@/server/auth/actor";

/** Runs a read for the signed-in author; other users' and missing books become a 404 page. */
export async function loadOr404<T>(read: (actor: Actor) => Promise<T>): Promise<T> {
  const actor = await requirePageActor();
  try {
    return await read(actor);
  } catch (err) {
    if (isNotFound(err)) notFound();
    throw err;
  }
}

/** The book header, once per request (layout and page both ask). */
export const bookHeader = cache((bookId: string) =>
  loadOr404((actor) => getBookHeader(actor, bookId)),
);
