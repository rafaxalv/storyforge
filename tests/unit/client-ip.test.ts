import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { trustedOrigins } from "@/server/auth/auth";
import { parseEnv } from "@/server/env";
import { clientIp } from "@/server/http";

const req = (remote: string, xff?: string) =>
  ({
    socket: { remoteAddress: remote },
    headers: xff === undefined ? {} : { "x-forwarded-for": xff },
  }) as unknown as IncomingMessage;

describe("client address for rate limits", () => {
  it("uses the socket address when no proxy is trusted, ignoring X-Forwarded-For", () => {
    expect(clientIp(req("203.0.113.9", "1.2.3.4"))).toBe("203.0.113.9");
  });

  it("behind one proxy uses the address that proxy appended (last entry)", () => {
    expect(clientIp(req("10.0.0.2", "spoofed, 198.51.100.7"), 1)).toBe("198.51.100.7");
  });

  it("behind two proxies uses the second entry from the right", () => {
    expect(clientIp(req("10.0.0.2", "spoofed, 198.51.100.7, 10.0.0.1"), 2)).toBe("198.51.100.7");
  });

  it("falls back to the socket address when the header is missing", () => {
    expect(clientIp(req("10.0.0.2"), 1)).toBe("10.0.0.2");
  });
});

describe("trusted origins", () => {
  const env = (extra: Record<string, string>) =>
    parseEnv({ DATABASE_URL: "postgres://u:p@h/db", BETTER_AUTH_SECRET: "s".repeat(32), ...extra });

  it("in development accepts both localhost and 127.0.0.1 for the dev server", () => {
    expect(trustedOrigins(env({ BETTER_AUTH_URL: "http://localhost:3000" }))).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("in production accepts only the public URL", () => {
    expect(
      trustedOrigins(
        env({
          NODE_ENV: "production",
          BETTER_AUTH_URL: "https://storyforge.example",
          EMAIL_TRANSPORT: "smtp",
          SMTP_URL: "smtps://mail.example",
        }),
      ),
    ).toEqual(["https://storyforge.example"]);
  });
});
