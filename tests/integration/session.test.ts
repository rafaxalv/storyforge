import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getAuth } from "@/server/auth/auth";
import { getDb } from "@/server/db/client";
import { session, user, verification } from "@/server/db/schema";
import { call, clearOutbox, requestLink, resetAuthTables, signIn } from "./auth-helpers";

beforeAll(resetAuthTables);
beforeEach(clearOutbox);

const DAY = 24 * 60 * 60 * 1000;

describe("auth-session: Session lifetime and sign-out", () => {
  it("links expire after 15 minutes", async () => {
    await requestLink("ttl@example.com");
    const [row] = await getDb().select().from(verification).orderBy(verification.createdAt);
    const ttl = (row?.expiresAt.getTime() ?? 0) - Date.now();
    expect(ttl).toBeGreaterThan(14 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("Session persists: 30 days, read back from the cookie", async () => {
    const { headers } = await signIn("persist@example.com");
    const s = await getAuth().api.getSession({ headers });
    expect(s?.user.email).toBe("persist@example.com");
    const days = ((s?.session.expiresAt.getTime() ?? 0) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("Sign-out deletes the session and clears the cookie", async () => {
    const { cookie, headers } = await signIn("signout@example.com");
    const [u] = await getDb().select().from(user).where(eq(user.email, "signout@example.com"));
    const res = await call("/sign-out", { body: {}, cookie });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().join("\n")).toMatch(/storyforge\.session_token=;/);
    expect(
      await getDb()
        .select()
        .from(session)
        .where(eq(session.userId, u?.id ?? "")),
    ).toHaveLength(0);
    expect(await getAuth().api.getSession({ headers })).toBeNull();
  });
});
