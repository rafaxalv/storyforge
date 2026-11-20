import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getActor, isNotFound, type Actor } from "@/server/auth/actor";
import { BookValidationError, Conflict } from "@/server/books/core";
import { log } from "@/server/log";
import { RichTextError } from "@/shared/rich-text";

/** What every book form gets back. */
export interface ActionState {
  ok?: boolean;
  error?: string;
  field?: string;
  conflict?: boolean;
  version?: number;
}

/** The message an author sees for an error the domain module raised on purpose. */
export function errorState(err: unknown): ActionState | null {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return { error: issue?.message ?? "Check the form.", field: issue?.path.join(".") };
  }
  if (err instanceof BookValidationError) return { error: err.message, field: err.field };
  if (err instanceof RichTextError) return { error: err.message, field: "body" };
  if (err instanceof Conflict) return { error: err.message, conflict: true };
  if (isNotFound(err)) return { error: "Not found." };
  return null;
}

/**
 * Runs a book action for the signed-in author: maps expected errors to form messages
 * (anything else is rethrown, so Next logs it and redirects still work), refreshes the
 * book's pages, and logs the op at debug level with its duration.
 */
export async function bookAction<S extends ActionState = ActionState>(
  op: string,
  bookId: unknown,
  fn: (actor: Actor) => Promise<S | void>,
): Promise<S | ActionState> {
  const started = performance.now();
  const actor = await getActor(undefined, op);
  const logger = log("books");
  logger.debug({ event: "books.action", op, userId: actor.userId }, "book action");
  try {
    const result: S | ActionState = (await fn(actor)) ?? {};
    if (typeof bookId === "string" && /^[0-9a-f-]{36}$/i.test(bookId))
      revalidatePath(`/books/${bookId}`, "layout");
    return { ok: true, ...result };
  } catch (err) {
    const state = errorState(err);
    if (!state) throw err;
    return state;
  } finally {
    logger.debug(
      { event: "books.action", op, ms: Math.round(performance.now() - started) },
      "book action done",
    );
  }
}

/** `title.EN`, `title.PT-BR` … form fields → `{ EN: …, "PT-BR": … }`. */
export function titlesFrom(form: FormData): Record<string, string> {
  const titles: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("title.") && typeof value === "string") titles[key.slice(6)] = value;
  }
  return titles;
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/** A number field; anything else becomes NaN, which the domain's checks reject. */
export function int(form: FormData, key: string): number {
  const v = form.get(key);
  return typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
}
