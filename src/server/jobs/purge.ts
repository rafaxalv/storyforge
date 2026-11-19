import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { user } from "../db/schema";
import { log } from "../log";

/**
 * Account purge: every epic that stores user data registers a step that removes that
 * user's rows and files. Steps run in registration order and must be idempotent (the job
 * is retried on failure).
 */
export type PurgeStep = (userId: string) => Promise<void>;

const steps: { name: string; run: PurgeStep }[] = [];

export function registerPurgeStep(name: string, run: PurgeStep): void {
  if (steps.some((s) => s.name === name)) throw new Error(`Purge step already registered: ${name}`);
  steps.push({ name, run });
}

/** Test helper: removes registered steps. */
export function clearPurgeStepsForTests(): void {
  steps.length = 0;
}

export const PurgePayload = z.object({
  userId: z.string().min(1),
  requestId: z.string().optional(),
});

/**
 * The `account.purge` job: runs every step; throws on the first failure so pg-boss retries.
 * The job is queued just before the account is deleted; if the account still exists (the
 * deletion failed after queueing), it does nothing.
 */
export async function runPurge(userId: string): Promise<number> {
  const logger = log("account");
  const [live] = await getDb().select({ id: user.id }).from(user).where(eq(user.id, userId));
  if (live) {
    logger.warn(
      { event: "account.purge.skipped", userId, reason: "account-exists" },
      "purge skipped",
    );
    return 0;
  }
  for (const step of steps) {
    try {
      await step.run(userId);
      logger.info(
        { event: "account.purge.step", userId, step: step.name, ok: true },
        "purge step done",
      );
    } catch (err) {
      logger.error(
        { event: "account.purge.step", userId, step: step.name, ok: false, err },
        "purge step failed",
      );
      throw err;
    }
  }
  logger.info(
    { event: "account.purge.done", userId, steps: steps.length },
    "account purge finished",
  );
  return steps.length;
}
