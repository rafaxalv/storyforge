import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";

const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  });

describe("auth-session: App pages require a session (middleware layer)", () => {
  it("redirects a signed-out visitor to sign-in with the requested path", () => {
    const res = middleware(req("/settings?tab=name"));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location") ?? "");
    expect(to.pathname).toBe("/sign-in");
    expect(to.searchParams.get("next")).toBe("/settings?tab=name");
  });

  it("sends the home page to plain /sign-in", () => {
    const to = new URL(middleware(req("/")).headers.get("location") ?? "");
    expect(to.pathname).toBe("/sign-in");
    expect(to.searchParams.has("next")).toBe(false);
  });

  it.each(["/sign-in", "/sign-in/check-email", "/goodbye", "/api/health", "/api/auth/get-session"])(
    "lets %s through without a session",
    (path) => {
      expect(middleware(req(path)).headers.get("location")).toBeNull();
    },
  );

  it("lets a request with a session cookie through (the layout validates it)", () => {
    expect(
      middleware(req("/settings", "storyforge.session_token=abc.def")).headers.get("location"),
    ).toBeNull();
  });
});
