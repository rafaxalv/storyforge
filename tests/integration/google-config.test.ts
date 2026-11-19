import { betterAuth } from "better-auth";
import { describe, expect, it } from "vitest";
import { authOptions } from "@/server/auth/auth";
import { parseEnv } from "@/server/env";

function authWith(extra: Record<string, string>) {
  return betterAuth(authOptions(parseEnv({ ...process.env, ...extra })));
}

describe("auth-session: Sign in with Google", () => {
  it("Google configured: sign-in redirects to Google's consent page with our client id", async () => {
    const auth = authWith({
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-secret",
    });
    const res = await auth.api.signInSocial({ body: { provider: "google", callbackURL: "/" } });
    const url = new URL(res.url ?? "");
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );
    // One email = one account: Google is a trusted provider for linking.
    expect(
      authOptions(parseEnv({ ...process.env })).account.accountLinking.trustedProviders,
    ).toContain("google");
  });

  it("Google not configured: the provider is not available", async () => {
    const auth = authWith({ GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" });
    await expect(
      auth.api.signInSocial({ body: { provider: "google", callbackURL: "/" } }),
    ).rejects.toThrow();
  });
});
