import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureLogs, UNREACHABLE_DB_URL, withDatabaseUrl } from "../helpers";

describe("service-health: Database unreachable", () => {
  const previous = process.env.DATABASE_URL ?? "";
  beforeAll(() => withDatabaseUrl(UNREACHABLE_DB_URL));
  afterAll(() => withDatabaseUrl(previous));

  it("responds 503 with only version and db status, and logs a warning", async () => {
    const { lines } = captureLogs();
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["db", "version"]);
    expect(body.db).toBe("error");
    expect(typeof body.version).toBe("string");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const warn = lines.find((l) => l.event === "health.db.failed");
    expect(warn).toMatchObject({ level: "warn", module: "storyforge:health" });
    expect(["error", "timeout"]).toContain(warn?.reason);
  });
});
