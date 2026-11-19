import { PgBoss } from "pg-boss";
import { currentContext } from "../context";
import { getEnv } from "../env";
import { log } from "../log";
import { processSingleton, peekProcessSingleton, setProcessSingleton } from "../singleton";
import { QUEUES, type QueueName } from "./names";

/** Options every queue gets: retries with backoff, kept for a week. */
const QUEUE_OPTIONS = {
  retryLimit: 5,
  retryDelay: 30,
  retryBackoff: true,
  retentionSeconds: 7 * 24 * 60 * 60,
} as const;

/** Creates the queues if missing (idempotent). Both senders and the worker call it. */
export async function ensureQueues(boss: PgBoss): Promise<void> {
  for (const name of Object.values(QUEUES)) {
    await boss.createQueue(name, QUEUE_OPTIONS);
  }
}

/**
 * Send-only pg-boss for the web role, started on first use and shared process-wide.
 * The worker has its own instance that also works jobs.
 */
function sender(): Promise<PgBoss> {
  return processSingleton("jobs.sender", async () => {
    const boss = new PgBoss({
      connectionString: getEnv().DATABASE_URL,
      schema: "pgboss",
      supervise: false,
      schedule: false,
    });
    boss.on("error", (err) => log("jobs").error({ event: "jobs.error", err }, "job queue error"));
    try {
      await boss.start();
      await ensureQueues(boss);
      return boss;
    } catch (err) {
      // Don't keep a failed start: the next enqueue tries again.
      setProcessSingleton("jobs.sender", undefined);
      throw err;
    }
  });
}

/**
 * Queues a job. The originating request id travels in the payload so the worker's log
 * lines can be correlated with the request that caused them. Failures are thrown to the
 * caller (retrying a job that runs is pg-boss's business, not the request's).
 */
export async function enqueue(
  queue: QueueName,
  data: Record<string, unknown>,
  options: { startAfter?: number } = {},
): Promise<string | null> {
  const boss = await sender();
  const requestId = currentContext()?.requestId;
  const jobId = await boss.send(queue, { ...data, requestId }, options);
  log("jobs").info({ event: "jobs.enqueued", queue, jobId }, `job queued on ${queue}`);
  return jobId;
}

/** Stops the send-only instance (shutdown and tests). */
export async function closeQueue(): Promise<void> {
  const pending = peekProcessSingleton<Promise<PgBoss>>("jobs.sender");
  setProcessSingleton("jobs.sender", undefined);
  if (pending) await (await pending).stop({ graceful: false, close: true });
}
