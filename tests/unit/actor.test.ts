import { describe, expect, it } from "vitest";
import {
  Forbidden,
  Unauthenticated,
  requireAdmin,
  requireOwner,
  withActorResponse,
  type Actor,
} from "@/server/auth/actor";
import { defaultName, roleFor } from "@/server/auth/auth";
import { emailHash } from "@/server/auth/hash";
import { captureLogs } from "../helpers";

const author: Actor = { userId: "u1", email: "a@b.co", name: "A", role: "user" };
const admin: Actor = { ...author, userId: "u2", role: "admin" };

describe("access helpers", () => {
  it("requireOwner allows the owner and refuses others with a logged reason", () => {
    const { lines } = captureLogs();
    expect(() => requireOwner(author, "u1", "op.test")).not.toThrow();
    expect(() => requireOwner(author, "u9", "op.test")).toThrow(Forbidden);
    expect(lines.find((l) => l.event === "access.denied")).toMatchObject({
      userId: "u1",
      reason: "not-owner",
      op: "op.test",
    });
  });

  it("requireAdmin allows admins only", () => {
    captureLogs();
    expect(() => requireAdmin(admin)).not.toThrow();
    expect(() => requireAdmin(author)).toThrow(Forbidden);
  });

  it("withActorResponse maps Unauthenticated to 401 and Forbidden to 404 without details", async () => {
    const r401 = await withActorResponse(async () => {
      throw new Unauthenticated();
    });
    expect(r401.status).toBe(401);
    const r404 = await withActorResponse(async () => {
      throw new Forbidden("not-owner");
    });
    expect(r404.status).toBe(404);
    expect(await r404.json()).toEqual({ error: "Not found" });
    await expect(
      withActorResponse(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});

describe("auth helpers", () => {
  it("roleFor follows ADMIN_EMAILS case-insensitively", () => {
    expect(roleFor("Boss@Example.com", ["boss@example.com"])).toBe("admin");
    expect(roleFor("someone@example.com", ["boss@example.com"])).toBe("user");
    expect(roleFor("boss@example.com", [])).toBe("user");
  });

  it("defaultName uses the local part of the address", () => {
    expect(defaultName("first.author@example.com")).toBe("first.author");
    expect(defaultName("@example.com")).toBe("Author");
    expect(defaultName(`${"x".repeat(100)}@example.com`)).toHaveLength(80);
  });

  it("emailHash is stable, case-insensitive, keyed and not the address", () => {
    const a = emailHash("A@B.co", "k".repeat(32));
    expect(a).toBe(emailHash("a@b.co ", "k".repeat(32)));
    expect(a).not.toBe(emailHash("a@b.co", "j".repeat(32)));
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });
});
