import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "@/server/env";

const valid = { DATABASE_URL: "postgres://u:p@127.0.0.1:5432/db" };

describe("environment validation", () => {
  it("accepts a minimal valid environment with defaults", () => {
    const env = parseEnv(valid);
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.AI_CLIENT).toBe("fake");
  });

  it("fails closed listing variable names, never values", () => {
    const secret = "postgres-with-a-secret-password";
    try {
      parseEnv({ DATABASE_URL: secret, LOG_LEVEL: "loud", PORT: "99999" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      const e = err as EnvError;
      expect(e.variables).toEqual(["DATABASE_URL", "LOG_LEVEL", "PORT"]);
      expect(e.message).not.toContain(secret);
      expect(e.message).not.toContain("loud");
    }
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(EnvError);
  });

  it("requires an API key only for the real Claude client", () => {
    expect(() => parseEnv({ ...valid, AI_CLIENT: "anthropic" })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => parseEnv({ ...valid, AI_CLIENT: "anthropic", ANTHROPIC_API_KEY: "" })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
    expect(
      parseEnv({ ...valid, AI_CLIENT: "anthropic", ANTHROPIC_API_KEY: "sk-x" }).AI_CLIENT,
    ).toBe("anthropic");
  });
});
