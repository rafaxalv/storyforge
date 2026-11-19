import { describe, expect, it } from "vitest";
import { createPool } from "@/server/db/client";
import { captureLogs, UNREACHABLE_DB_URL } from "../helpers";

describe("database pool", () => {
  it("logs a lost idle connection instead of crashing the process", async () => {
    const { lines } = captureLogs();
    const pool = createPool(UNREACHABLE_DB_URL);
    // Without a listener, emitting 'error' on an EventEmitter throws.
    expect(() => pool.emit("error", new Error("terminating connection"), undefined)).not.toThrow();
    expect(lines.find((l) => l.event === "db.pool.error")).toMatchObject({
      level: "warn",
      module: "storyforge:db",
    });
    await pool.end();
  });
});
