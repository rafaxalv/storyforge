import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AnthropicClaude,
  DEFAULT_MODEL,
  FakeClaude,
  MissingFixtureError,
  fixtureKey,
  getClaude,
} from "@/server/ai/client";
import { captureLogs } from "../helpers";

const params = {
  model: DEFAULT_MODEL,
  max_tokens: 1024,
  messages: [{ role: "user" as const, content: "Say hello" }],
};

describe("Claude seam", () => {
  afterEach(() => vi.restoreAllMocks());

  it("defaults to FakeClaude", () => {
    captureLogs();
    expect(getClaude({}).kind).toBe("fake");
    expect(getClaude({ AI_CLIENT: "something-else" }).kind).toBe("fake");
  });

  it("uses the real client only when asked, and requires a key", () => {
    captureLogs();
    expect(() => getClaude({ AI_CLIENT: "anthropic" })).toThrow(/ANTHROPIC_API_KEY/);
    expect(
      getClaude({ AI_CLIENT: "anthropic", ANTHROPIC_API_KEY: "sk-test-not-real" }),
    ).toBeInstanceOf(AnthropicClaude);
  });

  it("replays a fixture and streams its text", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const deltas: string[] = [];
    const message = await new FakeClaude().stream(
      params,
      { feature: "smoke", fixture: "hello" },
      (d) => deltas.push(d),
    );
    expect(message.content).toEqual([
      { type: "text", text: "Hello from FakeClaude.", citations: null },
    ]);
    expect(message.model).toBe(DEFAULT_MODEL);
    expect(message.stop_reason).toBe("end_turn");
    expect(message.usage.input_tokens).toBe(12);
    expect(deltas.join("")).toBe("Hello from FakeClaude.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails on a missing fixture without calling the network", async () => {
    const { lines } = captureLogs();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(new FakeClaude().stream(params, { feature: "smoke" })).rejects.toBeInstanceOf(
      MissingFixtureError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lines.some((l) => l.event === "ai.fixture.missing")).toBe(true);
  });

  it("rejects path-like feature names and fixture keys", async () => {
    await expect(new FakeClaude().stream(params, { feature: "../etc" })).rejects.toThrow(
      /Invalid feature/,
    );
    await expect(
      new FakeClaude().stream(params, { feature: "smoke", fixture: "../hello" }),
    ).rejects.toThrow(/Invalid fixture/);
  });

  it("derives a stable key regardless of property order", () => {
    const a = fixtureKey({ model: "m", max_tokens: 1, messages: [] });
    const b = fixtureKey({ messages: [], max_tokens: 1, model: "m" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});
