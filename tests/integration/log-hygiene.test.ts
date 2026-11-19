import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteAccount, updateDisplayName } from "@/server/account/account";
import { getActor } from "@/server/auth/actor";
import { getEnv } from "@/server/env";
import { closeQueue } from "@/server/jobs/queue";
import { captureLogs } from "../helpers";
import { clearOutbox, latestLink, resetAuthTables, signIn } from "./auth-helpers";

beforeAll(async () => {
  await resetAuthTables();
  await clearOutbox();
});
afterAll(closeQueue);

describe("log hygiene across sign-in, rename and deletion", () => {
  it("never logs the email address, the link token, the session token or the secret", async () => {
    const { lines } = captureLogs("trace");
    const email = "private.person@example.com";
    const { cookie, headers } = await signIn(email);
    const token = new URL(await latestLink(email)).searchParams.get("token") ?? "";
    const sessionToken = cookie.match(/session_token=([^;.]+)/)?.[1] ?? "";
    const me = await getActor(headers);
    await updateDisplayName(me, me.userId, "Private Person");
    await deleteAccount(headers, "DELETE");

    const all = JSON.stringify(lines);
    expect(lines.length).toBeGreaterThan(5);
    expect(token.length).toBeGreaterThan(10);
    expect(sessionToken.length).toBeGreaterThan(10);
    for (const secret of [
      email,
      "private.person",
      token,
      sessionToken,
      getEnv().BETTER_AUTH_SECRET,
    ]) {
      expect(all).not.toContain(secret);
    }
  });
});
