import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { updateDisplayName } from "@/server/account/account";
import { Forbidden, Unauthenticated, getActor, requireAdmin } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { captureLogs } from "../helpers";
import { resetAuthTables, twoUsers } from "./auth-helpers";

/**
 * The access pattern every later epic copies for each of its entities:
 * 1. no session → Unauthenticated, nothing changes;
 * 2. another user's row → Forbidden (404 to the client), nothing changes;
 * 3. admin-only operation by a non-admin → Forbidden.
 */
describe("auth-session: Access is checked on the server for every protected operation", () => {
  let users: Awaited<ReturnType<typeof twoUsers>>;
  beforeAll(async () => {
    await resetAuthTables();
    users = await twoUsers();
  });

  it("No session: the actor can't be established", async () => {
    const { lines } = captureLogs();
    await expect(getActor(new Headers(), "test.op")).rejects.toBeInstanceOf(Unauthenticated);
    await expect(
      getActor(new Headers({ cookie: "storyforge.session_token=forged.value" })),
    ).rejects.toBeInstanceOf(Unauthenticated);
    expect(lines.find((l) => l.event === "access.denied")).toMatchObject({
      reason: "unauthenticated",
      op: "test.op",
    });
  });

  it("Another user's data: Forbidden and unchanged", async () => {
    const alice = await getActor(users.alice);
    const [before] = await getDb().select().from(user).where(eq(user.id, users.bobId));
    await expect(updateDisplayName(alice, users.bobId, "Hacked")).rejects.toBeInstanceOf(Forbidden);
    const [after] = await getDb().select().from(user).where(eq(user.id, users.bobId));
    expect(after?.name).toBe(before?.name);
  });

  it("Own data: allowed", async () => {
    const bob = await getActor(users.bob);
    await expect(updateDisplayName(bob, users.bobId, "Bob")).resolves.toBe("Bob");
  });

  it("Admin-only operation by a non-admin: Forbidden", async () => {
    const alice = await getActor(users.alice);
    expect(alice.role).toBe("user");
    expect(() => requireAdmin(alice, "admin.op")).toThrow(Forbidden);
  });
});
