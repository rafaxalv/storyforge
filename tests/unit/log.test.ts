import { describe, expect, it } from "vitest";
import { requestContext } from "@/server/context";
import { log } from "@/server/log";
import { captureLogs } from "../helpers";

describe("logger", () => {
  it("names module loggers storyforge:<name>", () => {
    const { lines } = captureLogs();
    log("health").info({ event: "x" }, "hello");
    expect(lines[0]).toMatchObject({
      module: "storyforge:health",
      event: "x",
      msg: "hello",
      level: "info",
    });
  });

  it("adds the request id from the request context", async () => {
    const { lines } = captureLogs();
    await requestContext.run({ requestId: "req-1" }, async () => {
      await Promise.resolve();
      log("http").info("inside");
    });
    log("http").info("outside");
    expect(lines[0]?.requestId).toBe("req-1");
    expect(lines[1]?.requestId).toBeUndefined();
  });

  it("redacts cookies, authorization headers and secrets", () => {
    const { lines } = captureLogs();
    log("http").info({
      req: { headers: { cookie: "session=abc", authorization: "Bearer xyz", accept: "text/html" } },
      config: { apiKey: "sk-secret", password: "hunter2" },
    });
    const raw = JSON.stringify(lines[0]);
    expect(raw).not.toContain("session=abc");
    expect(raw).not.toContain("Bearer xyz");
    expect(raw).not.toContain("sk-secret");
    expect(raw).not.toContain("hunter2");
    expect(raw).toContain("text/html");
  });

  it("respects the level switch (LOG_LEVEL=warn drops info lines)", () => {
    const { lines } = captureLogs("warn");
    log("http").info({ event: "request" }, "GET / 200");
    log("http").warn({ event: "health.db.failed" }, "down");
    expect(lines.map((l) => l.event)).toEqual(["health.db.failed"]);
  });
});
