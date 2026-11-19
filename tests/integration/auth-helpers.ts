import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { getAuth, handleAuthRequest, type Auth } from "@/server/auth/auth";
import { getDb } from "@/server/db/client";
import { baseUrl, getEnv } from "@/server/env";
import { CLIENT_IP_HEADER } from "@/server/http";

/**
 * Helpers for exercising Better Auth for real (HTTP handler + Postgres + outbox emails)
 * from integration tests. Later epics reuse `signIn()` and `twoUsers()` for their access
 * tests.
 */

/** Empties the auth tables (and job rows) between test files. */
export async function resetAuthTables(): Promise<void> {
  await getDb().execute(
    sql`TRUNCATE "user", "session", "account", "verification", "rate_limit" CASCADE`,
  );
}

export async function clearOutbox(): Promise<void> {
  await rm(getEnv().MAIL_OUTBOX_DIR, { recursive: true, force: true });
}

interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  template: string;
}

/** All messages in the outbox, oldest first. */
export async function outbox(): Promise<OutboxMessage[]> {
  const dir = getEnv().MAIL_OUTBOX_DIR;
  let files: string[];
  try {
    files = (await readdir(dir)).sort();
  } catch {
    return [];
  }
  return Promise.all(
    files.map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8")) as OutboxMessage),
  );
}

/** The sign-in link in the newest message to `email`. */
export async function latestLink(email: string): Promise<string> {
  const mine = (await outbox()).filter((m) => m.to === email.toLowerCase() || m.to === email);
  const last = mine.at(-1);
  const link = last?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no sign-in link for ${email} in the outbox`);
  return link;
}

/** A random client address, so tests don't share a rate-limit bucket. */
export const randomIp = () =>
  `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250)).join(".")}`;

/** Calls Better Auth's HTTP handler like a browser on this origin would. */
export async function call(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; ip?: string } = {},
  auth: Auth = getAuth(),
): Promise<Response> {
  const headers = new Headers({ origin: baseUrl(), [CLIENT_IP_HEADER]: init.ip ?? randomIp() });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  const url = path.startsWith("http") ? path : `${baseUrl()}/api/auth${path}`;
  return handleAuthRequest(
    new Request(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: "manual",
    }),
    auth,
  );
}

/** "name=value; name2=value2" from a response's Set-Cookie headers. */
export function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c): c is string => Boolean(c) && !c?.endsWith("="))
    .join("; ");
}

export function requestLink(
  email: string,
  opts: { ip?: string; callbackURL?: string } = {},
  auth?: Auth,
) {
  return call(
    "/sign-in/magic-link",
    {
      body: { email, callbackURL: opts.callbackURL ?? "/", errorCallbackURL: "/sign-in/error" },
      ip: opts.ip,
    },
    auth,
  );
}

/** Full magic-link sign-in; returns the session cookie header and the response of the link. */
export async function signIn(
  email: string,
  auth?: Auth,
): Promise<{ cookie: string; headers: Headers; res: Response }> {
  const requested = await requestLink(email, {}, auth);
  if (!requested.ok) throw new Error(`link request failed: ${requested.status}`);
  const res = await call(await latestLink(email), {}, auth);
  const cookie = cookieFrom(res);
  if (!cookie.includes("session_token"))
    throw new Error(`no session cookie (status ${res.status})`);
  return { cookie, headers: new Headers({ cookie }), res };
}

/** Two signed-in authors, for "another user's data" tests. */
export async function twoUsers(): Promise<{
  alice: Headers;
  bob: Headers;
  aliceId: string;
  bobId: string;
}> {
  const a = await signIn(`alice-${crypto.randomUUID()}@example.com`);
  const b = await signIn(`bob-${crypto.randomUUID()}@example.com`);
  const id = async (h: Headers) => {
    const s = await getAuth().api.getSession({ headers: h });
    if (!s) throw new Error("no session");
    return s.user.id;
  };
  return {
    alice: a.headers,
    bob: b.headers,
    aliceId: await id(a.headers),
    bobId: await id(b.headers),
  };
}
