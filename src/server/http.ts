import type { IncomingMessage, ServerResponse } from "node:http";
import { requestContext, resolveRequestId } from "./context";
import { log } from "./log";

/** Header the boundary sets to the socket address; Better Auth reads only this one. */
export const CLIENT_IP_HEADER = "x-storyforge-client-ip";

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
export function withRequestBoundary(handler: Handler): Handler {
  return (req, res) => {
    const logger = log("http");
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    // The header copy is for Next.js code that reads headers(); server code uses the
    // request context.
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);
    // The client address for rate limits, from our own socket. Always overwritten, so a
    // client can't choose it (X-Forwarded-For is not trusted until a proxy is configured).
    req.headers[CLIENT_IP_HEADER] = req.socket.remoteAddress ?? "unknown";

    const started = process.hrtime.bigint();
    const method = req.method ?? "GET";
    const route = (req.url ?? "/").split("?")[0] ?? "/";
    // 'close' fires once per response: after 'finish' normally, alone when the client aborts.
    res.once("close", () => {
      // Static assets (JS/CSS chunks, favicon) are logged at debug so they don't bury
      // page and API requests at info.
      const level = isStaticAsset(route) ? "debug" : "info";
      if (!logger.isLevelEnabled(level)) return;
      const aborted = !res.writableFinished;
      const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
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
    });

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
