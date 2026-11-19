import type { Instrumentation } from "next";
import { log } from "./log";

type Params = Parameters<Instrumentation.onRequestError>;

/** Logs an error Next.js caught in a route handler or render, with the request id. */
export function logRequestError(error: Params[0], request: Params[1], context: Params[2]): void {
  const header = request.headers["x-request-id"];
  log("http").error(
    {
      event: "request.error",
      requestId: Array.isArray(header) ? header[0] : header,
      method: request.method,
      route: request.path.split("?")[0],
      routeType: context.routeType,
      err: error,
    },
    "unhandled error in request handler",
  );
}
