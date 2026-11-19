import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { authOptions, getAuth } from "@/server/auth/auth";
import { getDb } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { parseEnv } from "@/server/env";
import { captureLogs } from "../helpers";
import { resetAuthTables, signIn } from "./auth-helpers";

const EMAIL = "boss@example.com";

/** An auth instance configured as if ADMIN_EMAILS contained `admins`. */
function authWithAdmins(admins: string) {
  return betterAuth(authOptions(parseEnv({ ...process.env, ADMIN_EMAILS: admins })));
}

const roleOf = async () =>
  (await getDb().select({ role: user.role }).from(user).where(eq(user.email, EMAIL)))[0]?.role;

describe("auth-session: Admin role comes from configuration", () => {
  beforeAll(resetAuthTables);

  it("Listed author signs in: admin (matching is case-insensitive)", async () => {
    const { lines } = captureLogs();
    await signIn(EMAIL, authWithAdmins("Boss@Example.com, other@example.com"));
    expect(await roleOf()).toBe("admin");
    expect(lines.find((l) => l.event === "auth.role.synced")).toMatchObject({ role: "admin" });
  });

  it("Author removed from the list: back to user at the next sign-in", async () => {
    const { lines } = captureLogs();
    await signIn(EMAIL, getAuth()); // the test run's ADMIN_EMAILS is empty
    expect(await roleOf()).toBe("user");
    expect(lines.find((l) => l.event === "auth.role.synced")).toMatchObject({ role: "user" });
  });

  it("logs nothing when the role is already right", async () => {
    const { lines } = captureLogs();
    await signIn(EMAIL, getAuth());
    expect(lines.some((l) => l.event === "auth.role.synced")).toBe(false);
  });
});
