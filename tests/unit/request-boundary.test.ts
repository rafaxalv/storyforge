import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withRequestBoundary } from "@/server/http";
import { log } from "@/server/log";
import { captureLogs } from "../helpers";

let server: Server;
let base: string;
let lines: Record<string, unknown>[];

beforeAll(async () => {
  server = createServer(
    withRequestBoundary(async (req, res) => {
      const path = (req.url ?? "/").split("?")[0];
      if (path === "/boom") throw new Error("secret internal detail /var/app");
      // a log line written inside the handler must carry the request id
      log("test").info({ event: "inside.handler", seenHeader: req.headers["x-request-id"] });
      res.setHeader("content-type", "text/plain");
      res.end("ok");
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  lines = captureLogs().lines;
});

const requestLines = () => lines.filter((l) => l.event === "request");
const settle = () => new Promise((r) => setTimeout(r, 20));

describe("service-health: request correlation", () => {
  it("reuses a well-formed incoming id (Incoming id is reused)", async () => {
    const res = await fetch(`${base}/hello`, { headers: { "x-request-id": "abc-123" } });
    await settle();
    expect(res.headers.get("x-request-id")).toBe("abc-123");
    const inside = lines.find((l) => l.event === "inside.handler");
    expect(inside).toMatchObject({ requestId: "abc-123", seenHeader: "abc-123" });
    expect(requestLines()[0]?.requestId).toBe("abc-123");
  });

  it.each([
    ["missing", undefined],
    ["too long", "a".repeat(65)],
    ["bad characters", "bad id!"],
    ["log-injection attempt", 'x"}\n{"level":"fatal'],
  ])("replaces a %s id (Missing or malformed id is replaced)", async (_label, incoming) => {
    const headers: Record<string, string> = {};
    if (incoming !== undefined) {
      try {
        new Headers({ "x-request-id": incoming });
        headers["x-request-id"] = incoming;
      } catch {
        headers["x-request-id"] = "bad id!"; // fetch refuses newlines; still malformed
      }
    }
    const res = await fetch(`${base}/hello`, { headers });
    await settle();
    const id = res.headers.get("x-request-id") ?? "";
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(id).not.toBe(incoming);
    expect(requestLines()[0]?.requestId).toBe(id);
  });
});

describe("service-health: request log line", () => {
  it("writes exactly one request line with the required fields (Successful request logged)", async () => {
    await fetch(`${base}/hello?token=should-not-appear`, {
      method: "POST",
      headers: {
        cookie: "session=s3cret",
        authorization: "Bearer t0ken",
        "content-type": "text/plain",
      },
      body: "manuscript text that must not be logged",
    });
    await settle();
    const reqs = requestLines();
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toMatchObject({
      module: "storyforge:http",
      method: "POST",
      route: "/hello",
      status: 200,
    });
    expect(typeof reqs[0]?.durationMs).toBe("number");
    const raw = JSON.stringify(lines);
    for (const forbidden of [
      "session=s3cret",
      "Bearer t0ken",
      "manuscript text",
      "should-not-appear",
    ]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("returns a generic 500 and logs details only in the log", async () => {
    const res = await fetch(`${base}/boom`);
    await settle();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const err = lines.find((l) => l.event === "request.error");
    expect(JSON.stringify(err)).toContain("secret internal detail");
    expect(requestLines()).toHaveLength(1);
    expect(requestLines()[0]?.status).toBe(500);
  });
});
