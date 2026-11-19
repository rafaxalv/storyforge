import { describe, expect, it } from "vitest";
import { EnvError, parseEnv, baseUrl } from "@/server/env";

const base = {
  DATABASE_URL: "postgres://u:p@127.0.0.1:5432/db",
  BETTER_AUTH_SECRET: "s".repeat(32),
};

function failing(source: Record<string, string>): string[] {
  try {
    parseEnv(source);
  } catch (err) {
    if (err instanceof EnvError) return err.variables;
    throw err;
  }
  return [];
}

describe("auth and email environment rules", () => {
  it("requires a secret of at least 32 characters", () => {
    expect(failing({ DATABASE_URL: base.DATABASE_URL })).toEqual(["BETTER_AUTH_SECRET"]);
    expect(failing({ ...base, BETTER_AUTH_SECRET: "short" })).toEqual(["BETTER_AUTH_SECRET"]);
    expect(failing(base)).toEqual([]);
  });

  it("parses ADMIN_EMAILS case-insensitively and rejects non-emails", () => {
    expect(parseEnv({ ...base, ADMIN_EMAILS: " A@Example.com , b@x.io " }).ADMIN_EMAILS).toEqual([
      "a@example.com",
      "b@x.io",
    ]);
    expect(parseEnv(base).ADMIN_EMAILS).toEqual([]);
    expect(failing({ ...base, ADMIN_EMAILS: "not-an-email" })).toEqual(["ADMIN_EMAILS"]);
  });

  it("needs both Google credentials or neither", () => {
    expect(failing({ ...base, GOOGLE_CLIENT_ID: "id" })).toEqual(["GOOGLE_CLIENT_SECRET"]);
    expect(failing({ ...base, GOOGLE_CLIENT_SECRET: "s" })).toEqual(["GOOGLE_CLIENT_ID"]);
    expect(failing({ ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })).toEqual([]);
  });

  it("requires SMTP_URL for the smtp transport", () => {
    expect(failing({ ...base, EMAIL_TRANSPORT: "smtp" })).toEqual(["SMTP_URL"]);
    expect(
      failing({ ...base, EMAIL_TRANSPORT: "smtp", SMTP_URL: "smtp://localhost:2525" }),
    ).toEqual([]);
  });

  it("refuses console and outbox transports, and a missing public URL, in production", () => {
    const prod = { ...base, NODE_ENV: "production", BETTER_AUTH_URL: "https://storyforge.example" };
    expect(failing({ ...prod, EMAIL_TRANSPORT: "console" })).toEqual(["EMAIL_TRANSPORT"]);
    expect(failing({ ...prod, EMAIL_TRANSPORT: "outbox" })).toEqual(["EMAIL_TRANSPORT"]);
    expect(
      failing({
        ...base,
        NODE_ENV: "production",
        EMAIL_TRANSPORT: "smtp",
        SMTP_URL: "smtps://mail.example",
      }),
    ).toEqual(["BETTER_AUTH_URL"]);
    expect(failing({ ...prod, EMAIL_TRANSPORT: "smtp", SMTP_URL: "smtps://mail.example" })).toEqual(
      [],
    );
  });

  it("derives the base URL from BETTER_AUTH_URL or the port", () => {
    expect(baseUrl(parseEnv({ ...base, BETTER_AUTH_URL: "https://sf.example/" }))).toBe(
      "https://sf.example",
    );
    expect(baseUrl(parseEnv({ ...base, PORT: "4000" }))).toBe("http://localhost:4000");
  });
});
