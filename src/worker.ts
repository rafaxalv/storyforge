import { PgBoss } from "pg-boss";
import { log } from "@/server/log";
import { onShutdown, startProcess } from "@/server/startup";

/** Worker role: runs background jobs from the pg-boss queue (no queues registered yet). */
async function main(): Promise<void> {
  const env = startProcess("worker");
  const logger = log("worker");
  logger.info({ event: "worker.start" }, "starting job queue");

  const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: "pgboss" });
  boss.on("error", (err) => logger.error({ event: "worker.queue.error", err }, "job queue error"));

  try {
    await boss.start();
  } catch (err) {
    logger.error(
      { event: "worker.start.failed", err },
      "cannot start the job queue (database unreachable?)",
    );
    process.exit(1);
  }
  logger.info({ event: "worker.ready" }, "worker ready for jobs");

  onShutdown(logger, "worker.stop", () => boss.stop({ graceful: true, timeout: 10_000 }));
}

void main();
