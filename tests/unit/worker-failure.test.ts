import { describe, expect, it } from "vitest";
import { spawnTs } from "../process";
import { UNREACHABLE_DB_URL } from "../helpers";

describe("service-health: Worker cannot reach the database", () => {
  it("logs an error and exits non-zero", async () => {
    const p = spawnTs("src/worker.ts", { DATABASE_URL: UNREACHABLE_DB_URL });
    const code = await p.exit;
    expect(code).not.toBe(0);
    expect(p.lines.find((l) => l.event === "startup")).toMatchObject({
      role: "worker",
      env: "production",
    });
    expect(p.lines.find((l) => l.event === "worker.start.failed")).toMatchObject({
      level: "error",
    });
    expect(p.lines.some((l) => l.event === "worker.ready")).toBe(false);
  }, 30_000);

  it("refuses to start with an invalid environment, naming only the variable", async () => {
    const p = spawnTs("src/worker.ts", { DATABASE_URL: "not-a-url-but-secret-ish" });
    const code = await p.exit;
    expect(code).toBe(1);
    const invalid = p.lines.find((l) => l.event === "env.invalid");
    expect(invalid?.variables).toEqual(["DATABASE_URL"]);
    expect(JSON.stringify(p.lines)).not.toContain("secret-ish");
  }, 30_000);
});
