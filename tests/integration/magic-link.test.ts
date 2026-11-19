import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { session, user, verification } from "@/server/db/schema";
import { captureLogs } from "../helpers";
import {
  call,
  clearOutbox,
  latestLink,
  outbox,
  requestLink,
  resetAuthTables,
  signIn,
} from "./auth-helpers";

const path = (res: Response) => new URL(res.headers.get("location") ?? "", "http://x").pathname;
const location = (res: Response) => {
  const u = new URL(res.headers.get("location") ?? "", "http://x");
  return `${u.pathname}${u.search}`;
};

beforeAll(resetAuthTables);
beforeEach(clearOutbox);

describe("auth-session: Sign in with an emailed magic link", () => {
  it("First sign-in creates the account and lands on the requested page", async () => {
    const { lines } = captureLogs();
    const email = "first@example.com";
    const requested = await requestLink(email, { callbackURL: "/settings" });
    expect(requested.status).toBe(200);
    const mail = (await outbox()).at(-1);
    expect(mail).toMatchObject({ to: email, template: "magic-link" });

    const res = await call(await latestLink(email));
    expect(res.status).toBe(302);
    expect(path(res)).toBe("/settings");
    const cookies = res.headers.getSetCookie().join("\n");
    expect(cookies).toMatch(/storyforge\.session_token=/);
    expect(cookies).toMatch(/HttpOnly/i);
    expect(cookies).toMatch(/SameSite=Lax/i);

    const rows = await getDb().select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "first", role: "user", emailVerified: true });
    expect(lines.map((l) => l.event)).toEqual(
      expect.arrayContaining([
        "auth.magic_link.requested",
        "mail.sent",
        "auth.user.created",
        "auth.sign_in",
      ]),
    );
    expect(lines.find((l) => l.event === "auth.sign_in")).toMatchObject({ method: "magic-link" });
  });

  it("Returning author signs in without a second account", async () => {
    const email = "returning@example.com";
    await signIn(email);
    await signIn(email);
    const rows = await getDb().select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    const sessions = await getDb()
      .select()
      .from(session)
      .where(eq(session.userId, rows[0]?.id ?? ""));
    expect(sessions).toHaveLength(2);
  });

  it("Used link: a second use creates no session and goes to the error page", async () => {
    const email = "used@example.com";
    await requestLink(email);
    const link = await latestLink(email);
    expect((await call(link)).status).toBe(302);
    const again = await call(link);
    expect(location(again)).toMatch(/^\/sign-in\/error\?error=/);
    expect(again.headers.getSetCookie().join()).not.toMatch(/session_token=[^;]/);
  });

  it("Expired link: after 15 minutes it is refused", async () => {
    const email = "expired@example.com";
    await requestLink(email);
    const link = await latestLink(email);
    await getDb()
      .update(verification)
      .set({ expiresAt: sql`now() - interval '1 minute'` });
    const res = await call(link);
    expect(location(res)).toMatch(/^\/sign-in\/error\?error=/);
    expect(await getDb().select().from(user).where(eq(user.email, email))).toHaveLength(0);
  });

  it("Invalid address: rejected, nothing sent", async () => {
    const res = await requestLink("not-an-email");
    expect(res.status).toBe(400);
    expect(await outbox()).toHaveLength(0);
  });

  it("answers the same for known and unknown addresses", async () => {
    await signIn("known@example.com");
    const known = await requestLink("known@example.com");
    const unknown = await requestLink("never-seen@example.com");
    expect(known.status).toBe(unknown.status);
    expect(await known.text()).toBe(await unknown.text());
  });
});
