import { describe, expect, it } from "vitest";
import {
  CONCEPT_MAX_CHARS,
  RichTextError,
  emptyDoc,
  parseRichText,
  plainText,
  textLength,
} from "@/shared/rich-text";

const opts = { maxChars: CONCEPT_MAX_CHARS };
const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) =>
  marks ? { type: "text", text, marks } : { type: "text", text };

function reason(input: unknown, o: { maxChars: number; required?: boolean } = opts): string {
  try {
    parseRichText(input, o);
  } catch (err) {
    if (err instanceof RichTextError) return err.reason;
    throw err;
  }
  return "ok";
}

describe("book-profile: Concept is rich text with a fixed set of formats", () => {
  it("accepts the allowed StarterKit subset as TipTap writes it", () => {
    const input = doc(
      { type: "heading", attrs: { level: 2, id: null }, content: [t("Title")] },
      p(
        t("bold", [{ type: "bold" }]),
        t(" and "),
        t("both", [{ type: "italic" }, { type: "strike" }]),
      ),
      { type: "paragraph", attrs: { textAlign: null } },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [p(t("one"))] }],
      },
      {
        type: "orderedList",
        attrs: { start: 3, type: null },
        content: [{ type: "listItem", content: [p(t("three"))] }],
      },
      { type: "blockquote", content: [p(t("quoted"), { type: "hardBreak" }, t("next"))] },
      { type: "horizontalRule" },
    );
    const out = parseRichText(input, opts);
    expect(out.content[0]).toEqual({ type: "heading", attrs: { level: 2 }, content: [t("Title")] });
    expect(out.content[2]).toEqual({ type: "paragraph" });
    expect(out.content[4]?.attrs).toEqual({ start: 3 });
    expect(textLength(out)).toBe("Titlebold and bothonethreequotednext".length);
    expect(parseRichText(JSON.stringify(input), opts)).toEqual(out);
  });

  it("drops unknown keys", () => {
    const out = parseRichText(doc({ ...p(t("x")), evil: "<script>" }), opts);
    expect(JSON.stringify(out)).not.toContain("script");
  });

  it.each([
    ["a link mark", doc(p(t("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])))],
    ["inline code", doc(p(t("x", [{ type: "code" }])))],
    ["a code block", doc({ type: "codeBlock", content: [t("x")] })],
    ["an image", doc({ type: "image", attrs: { src: "http://evil" } })],
    ["raw HTML as a node", doc({ type: "html", content: "<img onerror=alert(1)>" })],
    ["heading level 4", doc({ type: "heading", attrs: { level: 4 }, content: [t("x")] })],
    ["a nested doc", doc(doc(p(t("x"))))],
    ["text without text", doc(p({ type: "text" }))],
    ["content that is not an array", doc({ type: "paragraph", content: "x" })],
    ["a string that is not JSON", "<p>hello</p>"],
    ["not a doc", p(t("x"))],
    ["null", null],
  ])("Disallowed content: rejects %s", (_name, input) => {
    expect(reason(input)).toBe("schema");
  });

  it("rejects documents nested too deep", () => {
    let node: unknown = p(t("x"));
    for (let i = 0; i < 25; i++) node = { type: "blockquote", content: [node] };
    expect(reason(doc(node))).toBe("schema");
  });

  it("Too large: rejects text past the limit and oversized JSON", () => {
    expect(reason(doc(p(t("a".repeat(11)))), { maxChars: 10 })).toBe("size");
    expect(reason(doc(p(t("a".repeat(10)))), { maxChars: 10 })).toBe("ok");
    expect(reason("x".repeat(1_000_001))).toBe("size");
  });

  it("required documents need text", () => {
    expect(reason(emptyDoc(), { maxChars: 10, required: true })).toBe("empty");
    expect(reason(doc(), opts)).toBe("ok");
    expect(parseRichText(doc(), opts)).toEqual(emptyDoc());
  });

  it("plain text keeps paragraphs apart", () => {
    expect(plainText(parseRichText(doc(p(t("a")), p(t("b"))), opts))).toBe("a\n\nb");
  });
});
