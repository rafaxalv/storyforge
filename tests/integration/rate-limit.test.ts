import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { rateLimit } from "@/server/db/schema";
import { captureLogs } from "../helpers";
import { clearOutbox, outbox, randomIp, requestLink, resetAuthTables } from "./auth-helpers";

beforeAll(resetAuthTables);
beforeEach(clearOutbox);

describe("auth-session: Sign-in attempts are rate limited", () => {
  it("Too many link requests: the 6th in 10 minutes gets 429 and no email", async () => {
    captureLogs();
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await requestLink(`rl-${i}@example.com`, { ip })).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(await outbox()).toHaveLength(5);
    // Another client is not affected.
    expect((await requestLink("other@example.com", { ip: randomIp() })).status).toBe(200);
  });

  it("keeps its counters in Postgres, so they hold across server processes", async () => {
    const rows = await getDb().select().from(rateLimit);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.key.includes("/sign-in/magic-link"))).toBe(true);
  });
});
