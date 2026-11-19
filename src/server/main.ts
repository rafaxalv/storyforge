import { createServer } from "node:http";
import next from "next";
import { closeDb } from "./db/client";
import { withRequestBoundary } from "./http";
import { log } from "./log";
import { onShutdown, startProcess } from "./startup";

/** Web role: Next.js behind the storyforge request boundary (request ids, request log). */
async function main(): Promise<void> {
  const env = startProcess("web");
  const logger = log("http");

  // hostname/port must be this server's: Next fetches redirect targets of server actions
  // from itself, and without them it defaults to localhost:3000 (another process, or none).
  const app = next({
    dev: env.NODE_ENV === "development",
    dir: process.cwd(),
    hostname: "localhost",
    port: env.PORT,
  });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer(
    withRequestBoundary((req, res) => handle(req, res), { trustProxyHops: env.TRUST_PROXY_HOPS }),
  );
  // e.g. EADDRINUSE: one clear line and exit, instead of an uncaught exception.
  server.once("error", (err) => {
    logger.fatal(
      { event: "server.start.failed", port: env.PORT, err },
      `cannot listen on port ${env.PORT}`,
    );
    process.exit(1);
  });
  server.listen(env.PORT, () => {
    logger.info(
      { event: "server.listening", port: env.PORT },
      `listening on http://localhost:${env.PORT}`,
    );
  });

  onShutdown(logger, "server.stop", async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDb();
  });
}

main().catch((err: unknown) => {
  log("http").fatal({ event: "server.start.failed", err }, "web server failed to start");
  process.exit(1);
});
