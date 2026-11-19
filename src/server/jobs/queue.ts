import { PgBoss } from "pg-boss";
import { currentContext } from "../context";
import { getEnv } from "../env";
import { log } from "../log";
import { processSingleton, peekProcessSingleton, setProcessSingleton } from "../singleton";
import { QUEUES, type QueueName } from "./names";

/** Options every queue gets: retries with backoff, kept for a week. */
export const QUEUE_OPTIONS = {
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Queues a job, retrying transient failures (3 attempts, 0.2 s then 1 s apart). The
 * originating request id travels in the payload so the worker's log lines can be
 * correlated with the request that caused them.
 */
export async function enqueue(
  queue: QueueName,
  data: Record<string, unknown>,
  retryDelaysMs: readonly number[] = [200, 1_000],
): Promise<string | null> {
  const requestId = currentContext()?.requestId;
  for (let attempt = 0; ; attempt++) {
    try {
      const boss = await sender();
      const jobId = await boss.send(queue, { ...data, requestId });
      log("jobs").info({ event: "jobs.enqueued", queue, jobId }, `job queued on ${queue}`);
      return jobId;
    } catch (err) {
      const wait = retryDelaysMs[attempt];
      if (wait === undefined) throw err;
      log("jobs").warn(
        { event: "jobs.enqueue.retry", queue, attempt: attempt + 1, err },
        "retrying enqueue",
      );
      await delay(wait);
    }
  }
}

/** Stops the send-only instance (shutdown and tests). */
export async function closeQueue(): Promise<void> {
  const pending = peekProcessSingleton<Promise<PgBoss>>("jobs.sender");
  setProcessSingleton("jobs.sender", undefined);
  if (pending) await (await pending).stop({ graceful: false, close: true });
}
