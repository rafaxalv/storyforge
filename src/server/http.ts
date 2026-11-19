import type { IncomingMessage, ServerResponse } from "node:http";
import { requestContext, resolveRequestId } from "./context";
import { log, type Logger } from "./log";

export type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

const GENERIC_500 = JSON.stringify({ error: "Internal server error" });

export function isStaticAsset(route: string): boolean {
  return route.startsWith("/_next/static/") || route === "/favicon.ico";
}

/**
 * Wraps a request handler with the storyforge request boundary:
 * - resolves the request id (reuse a well-formed `x-request-id`, else generate),
 *   returns it in the response and passes it on in the request headers;
 * - runs the handler inside the request context, so every log line carries `requestId`;
 * - writes exactly one `request` line when the response finishes or the client aborts;
 * - turns an unhandled error into a generic 500, with details only in the log.
 */
export function withRequestBoundary(
  handler: Handler,
  getLogger: () => Logger = () => log("http"),
): Handler {
  return (req, res) => {
    const logger = getLogger();
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);

    const started = process.hrtime.bigint();
    const method = req.method ?? "GET";
    const route = (req.url ?? "/").split("?")[0] ?? "/";
    let logged = false;
    const writeRequestLine = (aborted: boolean) => {
      if (logged) return;
      logged = true;
      const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
      // Static assets (JS/CSS chunks, favicon) are logged at debug so they don't bury
      // page and API requests at info.
      const level = isStaticAsset(route) ? "debug" : "info";
      logger[level](
        {
          event: "request",
          requestId,
          method,
          route,
          status: res.statusCode,
          durationMs,
          ...(aborted ? { aborted: true } : {}),
        },
        `${method} ${route} ${res.statusCode}`,
      );
    };
    res.once("finish", () => writeRequestLine(false));
    res.once("close", () => writeRequestLine(!res.writableFinished));

    return requestContext.run({ requestId }, async () => {
      try {
        await handler(req, res);
      } catch (err) {
        logger.error({ event: "request.error", method, route, err }, "unhandled error in request");
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(GENERIC_500);
        } else {
          res.end();
        }
      }
    });
  };
}
