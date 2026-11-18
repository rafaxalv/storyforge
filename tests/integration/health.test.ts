import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/server/db/client";
import { captureLogs, testDatabaseUrl } from "../helpers";

describe("service-health: Database reachable", () => {
  beforeAll(async () => {
    await closeDb();
    process.env.DATABASE_URL = testDatabaseUrl();
  });
  afterAll(() => closeDb());

  it("responds 200 with version and db ok", async () => {
    const { lines } = captureLogs();
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ version: expect.any(String), db: "ok" });
    expect(lines.some((l) => l.event === "health.db.failed")).toBe(false);
  });
});
