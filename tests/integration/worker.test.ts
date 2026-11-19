import { describe, expect, it } from "vitest";
import { spawnTs } from "../process";
import { testDatabaseUrl } from "../helpers";

describe("service-health: Worker starts", () => {
  it("logs startup then worker.ready, and stops cleanly on SIGTERM", async () => {
    const p = spawnTs("src/worker.ts", { DATABASE_URL: testDatabaseUrl() });
    try {
      const startup = await p.waitFor("startup");
      expect(startup).toMatchObject({ role: "worker", env: "test", logLevel: "info" });
      await p.waitFor("worker.ready");
      const events = p.lines.map((l) => l.event);
      expect(events.indexOf("startup")).toBeLessThan(events.indexOf("worker.ready"));
      p.child.kill("SIGTERM");
      await p.waitFor("worker.stop");
      expect(await p.exit).toBe(0);
    } finally {
      p.child.kill("SIGKILL");
    }
  }, 40_000);
});
