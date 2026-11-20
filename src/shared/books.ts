/**
 * Book rules shared by the server (validation) and the forms (hints and limits).
 */
import { z } from "zod";
import { CHAPTER_CODE, CHAPTER_CODE_HINT } from "./id-scheme";

export const LIMITS = {
  books: 100,
  languages: 10,
  rules: 100,
  labels: 20,
  parts: 30,
  chapters: 200,
} as const;

export const TITLE_MAX = 200;
export const ONE_LINER_MAX = 500;
export const NOTES_MAX = 20_000;
export const LANGUAGE_NAME_MAX = 60;
export const LABEL_MAX = 60;
export const WORDS_MAX = 2_000_000;

/** cowriter's truth labels, in order. */
export const DEFAULT_TRUTH_LABELS = [
  "DOCUMENTED",
  "STRONGLY SUPPORTED",
  "FAMILY TRADITION",
  "PLAUSIBLE RECONSTRUCTION",
  "FICTIONAL",
] as const;

export const LANGUAGE_CODE = /^[A-Z]{2}(-[A-Z]{2})?$/;
export const LANGUAGE_CODE_HINT = "Two letters, optionally a dash and two more (EN, PT-BR)";

export const BookTitle = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(TITLE_MAX, `At most ${TITLE_MAX} characters`);

export const LanguageCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(LANGUAGE_CODE, LANGUAGE_CODE_HINT);

export const LanguageName = z
  .string()
  .trim()
  .min(1, "Enter the language name")
  .max(LANGUAGE_NAME_MAX, `At most ${LANGUAGE_NAME_MAX} characters`);

export const NewBook = z.object({
  title: BookTitle,
  languageCode: LanguageCode,
  languageName: LanguageName,
});

/** Optional word count from a form field: "" or missing → null. */
const WordCount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce
    .number({ error: "Enter a whole number of words" })
    .int("Enter a whole number of words")
    .min(1, "At least 1 word")
    .max(WORDS_MAX, `At most ${WORDS_MAX.toLocaleString("en")} words`)
    .nullable(),
);

export const Profile = z
  .object({
    title: BookTitle,
    oneLiner: z.string().trim().max(ONE_LINER_MAX, `At most ${ONE_LINER_MAX} characters`),
    lengthTarget: WordCount,
    lengthLimit: WordCount,
    peopleNotes: z.string().max(NOTES_MAX, `At most ${NOTES_MAX.toLocaleString("en")} characters`),
  })
  .refine(
    (p) => p.lengthTarget === null || p.lengthLimit === null || p.lengthTarget <= p.lengthLimit,
    {
      path: ["lengthTarget"],
      message: "The target can't be above the limit",
    },
  );
export type ProfileInput = z.infer<typeof Profile>;

export const TruthLabels = z
  .array(
    z
      .string()
      .trim()
      .min(1, "A label can't be empty")
      .max(LABEL_MAX, `At most ${LABEL_MAX} characters per label`),
  )
  .min(1, "Keep at least one label")
  .max(LIMITS.labels, `At most ${LIMITS.labels} labels`)
  .refine((labels) => new Set(labels.map((l) => l.toLowerCase())).size === labels.length, {
    message: "Each label must be different",
  });

export const ChapterCode = z.string().trim().regex(CHAPTER_CODE, CHAPTER_CODE_HINT);

export type Direction = "up" | "down";
export const MoveDirection = z.enum(["up", "down"]);

/**
 * Validates titles per language against the book's languages: keys must be language codes
 * of the book, the written-first title is required, others may be empty (dropped).
 */
export function cleanTitles(
  input: unknown,
  languages: readonly { code: string; writtenFirst: boolean }[],
): { ok: true; titles: Record<string, string> } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return { ok: false, error: "Enter a title" };
  const codes = new Set(languages.map((l) => l.code));
  const titles: Record<string, string> = {};
  for (const [code, value] of Object.entries(input)) {
    if (!codes.has(code)) return { ok: false, error: `${code} is not a language of this book` };
    if (typeof value !== "string") return { ok: false, error: "Enter a title" };
    const title = value.trim();
    if (title.length > TITLE_MAX) return { ok: false, error: `At most ${TITLE_MAX} characters` };
    if (title) titles[code] = title;
  }
  const first = languages.find((l) => l.writtenFirst);
  if (first && !titles[first.code]) return { ok: false, error: `Enter the ${first.code} title` };
  return { ok: true, titles };
}

/** Moves `id` one step in `ids`; null when it is already at that edge or missing. */
export function moveWithin(
  ids: readonly string[],
  id: string,
  direction: Direction,
): string[] | null {
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j] as string, next[i] as string];
  return next;
}
