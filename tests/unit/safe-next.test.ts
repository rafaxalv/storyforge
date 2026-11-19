import { describe, expect, it } from "vitest";
import { safeNext } from "@/shared/safe-next";

describe("auth-session: Foreign redirect target (safeNext)", () => {
  it.each([
    ["/settings", "/settings"],
    ["/books/1?tab=plan#ch2", "/books/1?tab=plan#ch2"],
    [undefined, "/"],
    ["", "/"],
  ])("keeps local path %j", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "//evil.example",
    "https://evil.example",
    "http:evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "%2F%2Fevil.example",
    "/%2F%2Fevil.example",
    "/%5Cevil.example",
    "javascript:alert(1)",
    "/\nevil",
    "%E0%A4%A",
  ])("sends %j to the home page", (input) => {
    expect(safeNext(input)).toBe("/");
  });
});
