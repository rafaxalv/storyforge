import { z } from "zod";
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

/** The `account.purge` job: runs every step; throws on the first failure so pg-boss retries. */
export async function runPurge(payload: unknown): Promise<number> {
  const { userId } = PurgePayload.parse(payload);
  const logger = log("account");
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
