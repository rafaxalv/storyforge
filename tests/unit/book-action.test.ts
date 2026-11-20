import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorState } from "@/app/(app)/books/action-result";
import { Forbidden, NotFound } from "@/server/auth/actor";
import { BookValidationError, Conflict } from "@/server/books/core";
import { RichTextError } from "@/shared/rich-text";

describe("book actions: error mapping", () => {
  it("maps expected errors to form messages", () => {
    const zod = z
      .object({ title: z.string().min(1, "Enter a title") })
      .safeParse({ title: "" }).error;
    expect(errorState(zod)).toEqual({ error: "Enter a title", field: "title" });
    expect(errorState(new BookValidationError("Too many", "code"))).toEqual({
      error: "Too many",
      field: "code",
    });
    expect(errorState(new RichTextError("size"))).toEqual({
      error: "The text is too long.",
      field: "body",
    });
    expect(errorState(new Conflict("profile"))).toMatchObject({ conflict: true });
  });

  it("missing and foreign look the same", () => {
    expect(errorState(new NotFound())).toEqual({ error: "Not found." });
    expect(errorState(new Forbidden("not-owner"))).toEqual({ error: "Not found." });
  });

  it("leaves unexpected errors to the caller (rethrown, logged by Next)", () => {
    expect(errorState(new Error("database down"))).toBeNull();
  });
});
