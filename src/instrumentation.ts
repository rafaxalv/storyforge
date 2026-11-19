import type { Instrumentation } from "next";

/**
 * Next.js calls this for errors thrown while rendering or in route handlers. The details
 * go to the log with the request id; the client only ever sees Next's generic 500.
 *
 * Node-only code is imported inside the NEXT_RUNTIME branch so Next can drop it from the
 * edge bundle (pino needs Node built-ins).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logRequestError } = await import("./server/request-error");
    logRequestError(error, request, context);
  }
};
