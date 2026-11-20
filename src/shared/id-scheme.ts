/**
 * The paragraph-ID scheme (cowriter's): chapter code, a dot, a three-digit row, and a
 * letter suffix for insertions (`03.014`, `03.014a`). Chapter codes are two digits
 * (`01`–`98` regular, `00` prologue, `99` epilogue) or interludes (`INT`, `INT1`–`INT9`).
 * Shared by the server (validation) and the forms (hints). Paragraph ids arrive in E06.
 */

export const ID_SCHEMES = ["cowriter-v1"] as const;
export type IdScheme = (typeof ID_SCHEMES)[number];

export const ID_SCHEME_COWRITER_V1 = {
  id: "cowriter-v1",
  name: "cowriter",
  description:
    "Chapter code, a dot and a three-digit row; prologue 00, epilogue 99, interludes INT to INT9; a letter suffix marks an insertion.",
  examples: ["03.014", "00.001", "INT.002", "03.014a"],
} as const;

/** Source of the chapter-code pattern, usable in an HTML `pattern` attribute. */
export const CHAPTER_CODE_PATTERN = "\\d{2}|INT[1-9]?";
export const CHAPTER_CODE = new RegExp(`^(?:${CHAPTER_CODE_PATTERN})$`);
export const CHAPTER_CODE_HINT = "Two digits (01–98), 00 prologue, 99 epilogue, or INT, INT1–INT9";

export type ChapterKind = "chapter" | "prologue" | "epilogue" | "interlude";

export function isChapterCode(code: string): boolean {
  return CHAPTER_CODE.test(code);
}

export function chapterKind(code: string): ChapterKind {
  if (code === "00") return "prologue";
  if (code === "99") return "epilogue";
  if (code.startsWith("INT")) return "interlude";
  return "chapter";
}

/** The lowest unused regular code (`01`–`98`), or null when all are taken. */
export function suggestNextCode(existing: Iterable<string>): string | null {
  const used = new Set(existing);
  for (let n = 1; n <= 98; n++) {
    const code = String(n).padStart(2, "0");
    if (!used.has(code)) return code;
  }
  return null;
}
