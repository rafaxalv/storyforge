import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAuth, isStaleSessionError } from "../auth/auth";
import { requireOwner, type Actor } from "../auth/actor";
import { getDb } from "../db/client";
import { user } from "../db/schema";
import { log } from "../log";

const DisplayName = z.string().trim().min(1, "Enter a name").max(80, "At most 80 characters");

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

const DELETE_CONFIRMATION = "DELETE";

export type DeleteResult =
  { ok: true } | { ok: false; reason: "confirmation" | "stale-session" | "unauthenticated" };

/**
 * Deletes the signed-in user's account. Needs the typed confirmation; Better Auth requires
 * a session younger than `freshAge` (24 h), removes user, sessions and accounts, and its
 * delete hooks queue the purge job.
 */
export async function deleteAccount(
  headers: Headers,
  confirmation: unknown,
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
  try {
    await auth.api.deleteUser({ headers, body: {} });
  } catch (err) {
    if (!isStaleSessionError(err)) throw err;
    logger.warn(
      { event: "account.delete.refused", userId, reason: "stale-session" },
      "session too old",
    );
    return { ok: false, reason: "stale-session" };
  }
  return { ok: true };
}
