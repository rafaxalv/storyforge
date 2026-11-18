import { createServer } from "node:http";
import next from "next";
import { getClaude } from "./ai/client";
import { closeDb } from "./db/client";
import { withRequestBoundary } from "./http";
import { log } from "./log";
import { startProcess } from "./startup";

/** Web role: Next.js behind the storyforge request boundary (request ids, request log). */
async function main(): Promise<void> {
  const env = startProcess("web");
  const logger = log("http");
  getClaude(); // logs which Claude client is active (debug)

  const app = next({ dev: env.NODE_ENV === "development", dir: process.cwd() });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer(withRequestBoundary((req, res) => handle(req, res)));
  server.listen(env.PORT, () => {
    logger.info(
      { event: "server.listening", port: env.PORT },
      `listening on http://localhost:${env.PORT}`,
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ event: "server.stop", signal }, "shutting down");
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  log("http").fatal({ event: "server.start.failed", err }, "web server failed to start");
  process.exit(1);
});
