import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { deleteAccount, updateDisplayName } from "@/server/account/account";
import { getActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { account, session, user, verification } from "@/server/db/schema";
import { closeQueue } from "@/server/jobs/queue";
import { captureLogs } from "../helpers";
import { call, clearOutbox, requestLink, resetAuthTables, signIn } from "./auth-helpers";

beforeAll(resetAuthTables);
beforeEach(clearOutbox);
afterAll(closeQueue);

const userByEmail = async (email: string) =>
  (await getDb().select().from(user).where(eq(user.email, email)))[0];

describe("account-management: Author can set a display name", () => {
  it("Valid name: stored trimmed", async () => {
    const { headers } = await signIn("namer@example.com");
    const me = await getActor(headers);
    expect(await updateDisplayName(me, me.userId, "  Rafael  ")).toBe("Rafael");
    expect((await userByEmail("namer@example.com"))?.name).toBe("Rafael");
  });

  it.each(["", "   ", "x".repeat(81), 42])("Invalid name %j: rejected, unchanged", async (bad) => {
    const { headers } = await signIn("namer2@example.com");
    const me = await getActor(headers);
    const before = (await userByEmail("namer2@example.com"))?.name;
    await expect(updateDisplayName(me, me.userId, bad)).rejects.toBeInstanceOf(ZodError);
    expect((await userByEmail("namer2@example.com"))?.name).toBe(before);
  });
});

describe("account-management: Author can delete their account", () => {
  it("Confirmed deletion: rows removed, purge queued, re-sign-in makes a new empty account", async () => {
    const { lines } = captureLogs();
    const email = "leaver@example.com";
    const { headers } = await signIn(email);
    await requestLink(email); // leaves an unused link behind
    const before = await userByEmail(email);

    expect(await deleteAccount(headers, "DELETE")).toEqual({ ok: true });

    expect(await userByEmail(email)).toBeUndefined();
    expect(
      await getDb()
        .select()
        .from(session)
        .where(eq(session.userId, before?.id ?? "")),
    ).toHaveLength(0);
    expect(
      await getDb()
        .select()
        .from(account)
        .where(eq(account.userId, before?.id ?? "")),
    ).toHaveLength(0);
    expect(
      await getDb().select().from(verification).where(eq(verification.identifier, email)),
    ).toHaveLength(0);

    const jobs = await getDb().execute<{ data: { userId: string } }>(
      sql`SELECT data FROM pgboss.job WHERE name = 'account.purge' AND data->>'userId' = ${before?.id ?? ""}`,
    );
    expect(jobs.rows).toHaveLength(1);
    expect(JSON.stringify(jobs.rows[0])).not.toContain(email);
    expect(lines.map((l) => l.event)).toEqual(
      expect.arrayContaining(["account.delete.requested", "account.deleted", "jobs.enqueued"]),
    );

    await signIn(email);
    const again = await userByEmail(email);
    expect(again?.id).not.toBe(before?.id);
  });

  it("Missing confirmation: nothing deleted", async () => {
    const email = "hesitant@example.com";
    const { headers } = await signIn(email);
    for (const wrong of ["", "delete", "DELETE ", null]) {
      expect(await deleteAccount(headers, wrong)).toEqual({ ok: false, reason: "confirmation" });
    }
    expect(await userByEmail(email)).toBeDefined();
  });

  it("Old session: nothing deleted, asked to sign in again", async () => {
    const { lines } = captureLogs();
    const email = "stale@example.com";
    const { headers } = await signIn(email);
    const u = await userByEmail(email);
    await getDb()
      .update(session)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(eq(session.userId, u?.id ?? ""));
    expect(await deleteAccount(headers, "DELETE")).toEqual({ ok: false, reason: "stale-session" });
    expect(await userByEmail(email)).toBeDefined();
    expect(lines.find((l) => l.event === "account.delete.refused")).toMatchObject({
      reason: "stale-session",
    });
  });

  it("refuses without a session", async () => {
    expect(await deleteAccount(new Headers(), "DELETE")).toEqual({
      ok: false,
      reason: "unauthenticated",
    });
  });

  it("Better Auth's own delete endpoint is closed: deletion only via the confirmed action", async () => {
    const email = "bypass@example.com";
    const { cookie } = await signIn(email);
    const res = await call("/delete-user", { body: {}, cookie });
    expect(res.status).toBe(404);
    expect(await userByEmail(email)).toBeDefined();
  });
});
