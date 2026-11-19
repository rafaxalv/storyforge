import { log } from "../log";
import { getAuth, type Role } from "./auth";

/** The signed-in user, as every domain function receives it. */
export interface Actor {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

/** No valid session. API: 401; pages and actions: redirect to sign-in. */
export class Unauthenticated extends Error {
  constructor() {
    super("Not signed in");
    this.name = "Unauthenticated";
  }
}

/**
 * Not allowed. API: 404 (we never confirm that another user's data exists); pages: not
 * found.
 */
export class Forbidden extends Error {
  constructor(public readonly reason: "not-owner" | "not-admin") {
    super("Not found");
    this.name = "Forbidden";
  }
}

async function requestHeaders(): Promise<Headers> {
  const { headers } = await import("next/headers");
  return new Headers(await headers());
}

/** The actor for these request headers (default: the current Next.js request), or null. */
export async function getOptionalActor(headers?: Headers): Promise<Actor | null> {
  const result = await getAuth().api.getSession({ headers: headers ?? (await requestHeaders()) });
  if (!result) return null;
  const { user } = result;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "admin" ? "admin" : "user",
  };
}

/** The actor for these request headers; throws Unauthenticated without a valid session. */
export async function getActor(headers?: Headers, op = "unknown"): Promise<Actor> {
  const actor = await getOptionalActor(headers);
  if (!actor) {
    log("access").warn({ event: "access.denied", reason: "unauthenticated", op }, "no session");
    throw new Unauthenticated();
  }
  return actor;
}

/** Throws Forbidden unless the actor owns the row. */
export function requireOwner(actor: Actor, ownerId: string, op = "unknown"): void {
  if (actor.userId !== ownerId) {
    log("access").warn(
      { event: "access.denied", userId: actor.userId, reason: "not-owner", op },
      "not owner",
    );
    throw new Forbidden("not-owner");
  }
}

/** Throws Forbidden unless the actor is an admin. */
export function requireAdmin(actor: Actor, op = "unknown"): void {
  if (actor.role !== "admin") {
    log("access").warn(
      { event: "access.denied", userId: actor.userId, reason: "not-admin", op },
      "not admin",
    );
    throw new Forbidden("not-admin");
  }
}

/**
 * Maps access errors for route handlers: Unauthenticated → 401, Forbidden → 404, both
 * with a generic JSON body. Other errors propagate (generic 500 at the boundary).
 */
export async function withActorResponse(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof Unauthenticated)
      return Response.json({ error: "Not signed in" }, { status: 401 });
    if (err instanceof Forbidden) return Response.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
