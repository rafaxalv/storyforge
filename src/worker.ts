import { PgBoss } from "pg-boss";
import { registerBooksPurge } from "@/server/books/purge";
import { requestContext } from "@/server/context";
import { QUEUES } from "@/server/jobs/names";
import { PurgePayload, runPurge } from "@/server/jobs/purge";
import { ensureQueues } from "@/server/jobs/queue";
import { log } from "@/server/log";
import { onShutdown, startProcess } from "@/server/startup";

/** Worker role: runs background jobs from the pg-boss queue. */
async function main(): Promise<void> {
  const env = startProcess("worker");
  const logger = log("worker");
  registerBooksPurge();
  logger.info({ event: "worker.start" }, "starting job queue");

  const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: "pgboss" });
  boss.on("error", (err) => logger.error({ event: "worker.queue.error", err }, "job queue error"));

  try {
    await boss.start();
    await ensureQueues(boss);
  } catch (err) {
    logger.error(
      { event: "worker.start.failed", err },
      "cannot start the job queue (database unreachable?)",
    );
    process.exit(1);
  }

  // Each job runs in a request context carrying the job id and the originating request id,
  // so its log lines can be followed back to the request that queued it.
  await boss.work(QUEUES.accountPurge, async ([job]) => {
    if (!job) return;
    const { userId, requestId } = PurgePayload.parse(job.data);
    await requestContext.run({ requestId: requestId ?? job.id, jobId: job.id }, () =>
      runPurge(userId),
    );
  });

  logger.info({ event: "worker.ready", queues: Object.values(QUEUES) }, "worker ready for jobs");

  onShutdown(logger, "worker.stop", () => boss.stop({ graceful: true, timeout: 10_000 }));
}

void main();
