import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "../auth/auth";
import { requireOwner, type Actor } from "../auth/actor";
import { getDb } from "../db/client";
import { user } from "../db/schema";
import { log } from "../log";

export const DisplayName = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(80, "At most 80 characters");

/** Sets the display name of `userId`; only that user may do it. Returns the stored name. */
export async function updateDisplayName(
  actor: Actor,
  userId: string,
  name: unknown,
): Promise<string> {
  requireOwner(actor, userId, "account.updateDisplayName");
  const clean = DisplayName.parse(name);
  await getDb().update(user).set({ name: clean, updatedAt: new Date() }).where(eq(user.id, userId));
  log("account").info({ event: "account.name.updated", userId }, "display name updated");
  return clean;
}

export const DELETE_CONFIRMATION = "DELETE";
export const FRESH_SESSION_MS = 24 * 60 * 60 * 1000;

export type DeleteResult =
  { ok: true } | { ok: false; reason: "confirmation" | "stale-session" | "unauthenticated" };

/**
 * Deletes the signed-in user's account. Needs the typed confirmation and a session created
 * within 24 hours; Better Auth removes user, sessions and accounts and its afterDelete hook
 * queues the purge job.
 */
export async function deleteAccount(
  headers: Headers,
  confirmation: unknown,
  now = Date.now(),
): Promise<DeleteResult> {
  const logger = log("account");
  const auth = getAuth();
  const current = await auth.api.getSession({ headers });
  if (!current) return { ok: false, reason: "unauthenticated" };
  const userId = current.user.id;
  logger.info({ event: "account.delete.requested", userId }, "account deletion requested");

  if (confirmation !== DELETE_CONFIRMATION) {
    logger.warn(
      { event: "account.delete.refused", userId, reason: "confirmation" },
      "deletion not confirmed",
    );
    return { ok: false, reason: "confirmation" };
  }
  if (now - new Date(current.session.createdAt).getTime() > FRESH_SESSION_MS) {
    logger.warn(
      { event: "account.delete.refused", userId, reason: "stale-session" },
      "session too old",
    );
    return { ok: false, reason: "stale-session" };
  }
  await auth.api.deleteUser({ headers, body: {} });
  return { ok: true };
}
