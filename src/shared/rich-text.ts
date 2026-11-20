/**
 * Rich text is stored as ProseMirror JSON (what TipTap's `getJSON()` produces), limited to
 * an allowlist of node and mark types. The server parses every document with
 * `parseRichText()` before storing it: unknown types fail, unknown keys and attributes are
 * dropped, and text length, depth and size are capped. Nothing here produces HTML.
 */

export const RICH_TEXT_NODES = [
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
  "text",
] as const;
export const RICH_TEXT_MARKS = ["bold", "italic", "strike"] as const;

type NodeType = (typeof RICH_TEXT_NODES)[number];
type MarkType = (typeof RICH_TEXT_MARKS)[number];

export interface RichMark {
  type: MarkType;
}

export interface RichNode {
  type: NodeType;
  attrs?: Record<string, number>;
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
}

export interface RichDoc extends RichNode {
  type: "doc";
  content: RichNode[];
}

export const MAX_DEPTH = 20;
export const MAX_JSON_BYTES = 1_000_000;
export const CONCEPT_MAX_CHARS = 200_000;
export const RULE_MAX_CHARS = 10_000;

export class RichTextError extends Error {
  constructor(public readonly reason: "schema" | "size" | "empty") {
    super(
      reason === "size"
        ? "The text is too long."
        : reason === "empty"
          ? "Write something first."
          : "The text has formatting that is not allowed.",
    );
    this.name = "RichTextError";
  }
}

export function emptyDoc(): RichDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNodeType = (v: unknown): v is NodeType =>
  typeof v === "string" && (RICH_TEXT_NODES as readonly string[]).includes(v);

const isMarkType = (v: unknown): v is MarkType =>
  typeof v === "string" && (RICH_TEXT_MARKS as readonly string[]).includes(v);

interface Budget {
  chars: number;
}

function cleanAttrs(type: NodeType, attrs: unknown): Record<string, number> | undefined {
  if (type === "heading") {
    const level = isRecord(attrs) ? attrs.level : undefined;
    if (level !== 1 && level !== 2 && level !== 3) throw new RichTextError("schema");
    return { level };
  }
  if (type === "orderedList") {
    const start = isRecord(attrs) ? attrs.start : undefined;
    if (start === undefined || start === null) return { start: 1 };
    if (typeof start !== "number" || !Number.isInteger(start) || start < 0 || start > 100_000)
      throw new RichTextError("schema");
    return { start };
  }
  return undefined;
}

function cleanNode(input: unknown, depth: number, budget: Budget): RichNode {
  if (depth > MAX_DEPTH) throw new RichTextError("schema");
  if (!isRecord(input) || !isNodeType(input.type) || input.type === "doc")
    throw new RichTextError("schema");
  const type = input.type;

  if (type === "text") {
    if (typeof input.text !== "string" || input.text.length === 0)
      throw new RichTextError("schema");
    budget.chars += input.text.length;
    const node: RichNode = { type, text: input.text };
    if (input.marks !== undefined) {
      if (!Array.isArray(input.marks)) throw new RichTextError("schema");
      const marks = input.marks.map((m): RichMark => {
        if (!isRecord(m) || !isMarkType(m.type)) throw new RichTextError("schema");
        return { type: m.type };
      });
      if (marks.length > 0) node.marks = marks;
    }
    return node;
  }

  const node: RichNode = { type };
  const attrs = cleanAttrs(type, input.attrs);
  if (attrs) node.attrs = attrs;
  if (input.marks !== undefined) throw new RichTextError("schema");
  if (input.content !== undefined) {
    if (!Array.isArray(input.content)) throw new RichTextError("schema");
    if (type === "horizontalRule" || type === "hardBreak") throw new RichTextError("schema");
    const content = input.content.map((c) => cleanNode(c, depth + 1, budget));
    if (content.length > 0) node.content = content;
  }
  return node;
}

/** Number of text characters in a parsed document. */
export function textLength(doc: RichNode): number {
  let n = doc.text?.length ?? 0;
  for (const child of doc.content ?? []) n += textLength(child);
  return n;
}

/** Plain text of a document, paragraphs separated by blank lines (for previews and tests). */
export function plainText(doc: RichNode): string {
  if (doc.type === "text") return doc.text ?? "";
  if (doc.type === "hardBreak") return "\n";
  const inner = (doc.content ?? []).map(plainText);
  return doc.type === "doc" || doc.type.endsWith("List") || doc.type === "blockquote"
    ? inner.join("\n\n")
    : inner.join("");
}

/**
 * Parses untrusted input into an allowed document. Throws RichTextError ("schema" for
 * disallowed structure, "size" past `maxChars` or the JSON size cap, "empty" when
 * `required` and there is no text).
 */
export function parseRichText(
  input: unknown,
  opts: { maxChars: number; required?: boolean },
): RichDoc {
  let raw = input;
  if (typeof raw === "string") {
    if (raw.length > MAX_JSON_BYTES) throw new RichTextError("size");
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      throw new RichTextError("schema");
    }
  } else if (JSON.stringify(raw ?? null).length > MAX_JSON_BYTES) {
    throw new RichTextError("size");
  }
  if (!isRecord(raw) || raw.type !== "doc" || !Array.isArray(raw.content))
    throw new RichTextError("schema");
  const budget: Budget = { chars: 0 };
  const content = raw.content.map((c) => cleanNode(c, 1, budget));
  if (budget.chars > opts.maxChars) throw new RichTextError("size");
  if (opts.required && budget.chars === 0) throw new RichTextError("empty");
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}
