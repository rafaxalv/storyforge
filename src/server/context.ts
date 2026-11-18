import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  /** Set for background jobs (from E08); jobs also keep the originating requestId. */
  jobId?: string;
}

// The custom server (bundled by esbuild) and Next.js route handlers (bundled by Next)
// load separate copies of this module. Keeping the store on globalThis gives both
// copies the same AsyncLocalStorage, so the request id reaches route-handler logs.
const KEY = Symbol.for("storyforge.requestContext");
type Holder = { [KEY]?: AsyncLocalStorage<RequestContext> };

export const requestContext: AsyncLocalStorage<RequestContext> = ((globalThis as Holder)[KEY] ??=
  new AsyncLocalStorage<RequestContext>());

export function currentContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/** Accepted incoming ids: 1-64 letters, digits, '-' or '_' (no spaces or control chars). */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Reuses a well-formed incoming id, otherwise generates a new one. */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  if (value && REQUEST_ID_PATTERN.test(value)) return value;
  return crypto.randomUUID();
}
