/**
 * The fixed style framework from cowriter's voice-generator skill (as of 2026-11-17):
 * five unscored tags and 31 dimensions scored 1-5 between two named poles (3 = balanced).
 * Fixed for every book (PRD A5); changing it is a product change, not a per-book setting.
 */

export const TAGS = [
  { key: "narrativePerson", name: "Narrative person", options: ["1st", "2nd", "3rd", "mixed"] },
  {
    key: "addressedTo",
    name: "Addressed to",
    options: ["no one", "the reader", "a specific person in the story"],
  },
  {
    key: "form",
    name: "Form",
    options: [
      "plain narration",
      "spoken telling",
      "letter",
      "diary",
      "testimony or interview",
      "document",
      "mixed",
    ],
  },
  {
    key: "literacy",
    name: "Literacy",
    options: ["cannot write", "barely literate", "basic", "educated", "formal or official"],
  },
  { key: "language", name: "Language", options: [] },
] as const;

export type DimensionGroup = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export const GROUPS: Readonly<Record<DimensionGroup, string>> = {
  A: "Voice and perspective",
  B: "Language",
  C: "Time and structure",
  D: "History and reality",
  E: "Emotion and ethics",
  F: "Narrative technique",
  G: "Scene architecture",
};

export interface Dimension {
  readonly number: number;
  readonly group: DimensionGroup;
  readonly name: string;
  /** Meaning of a score of 1. */
  readonly low: string;
  /** Meaning of a score of 5. */
  readonly high: string;
}

const d = (
  number: number,
  group: DimensionGroup,
  name: string,
  low: string,
  high: string,
): Dimension => Object.freeze({ number, group, name, low, high });

export const DIMENSIONS: readonly Dimension[] = Object.freeze([
  d(
    1,
    "A",
    "Narrative distance",
    "far away, panoramic, chronicle-like",
    "deep inside a character's head",
  ),
  d(
    2,
    "A",
    "Narrator presence",
    "invisible narrator",
    "narrator comments, judges, addresses the reader",
  ),
  d(3, "A", "Point of view range", "one fixed viewpoint", "many shifting viewpoints, a chorus"),
  d(4, "A", "Orality", "written, literary prose", "sounds like a story told aloud"),
  d(5, "B", "Sentence length and rhythm", "short, clipped", "long, flowing, many clauses"),
  d(6, "B", "Register", "plain, everyday words", "elevated, ornate, rare vocabulary"),
  d(7, "B", "Figurative density", "literal", "dense with metaphor and image, lyrical"),
  d(8, "B", "Sensory detail", "sparse, only what is needed", "immersive smells, textures, sounds"),
  d(9, "C", "Scene vs summary", "moment-by-moment scenes", "summary, years in a sentence"),
  d(10, "C", "Chronology", "strictly linear", "fragmented, jumps back and forth"),
  d(11, "C", "Dialogue share", "almost no dialogue", "dialogue-driven"),
  d(12, "C", "Pace", "slow, contemplative", "fast, plot-forward"),
  d(13, "D", "Historical texture", "history as a faint backdrop", "dense documentary detail"),
  d(14, "D", "Realism", "strict realism", "myth, legend, magical realism"),
  d(
    15,
    "D",
    "Causality",
    "events driven by characters' will",
    "events driven by chance, fate, luck",
  ),
  d(16, "E", "Moral stance", "text clearly judges right and wrong", "fully ambiguous, no verdicts"),
  d(17, "E", "Violence rendering", "offstage, implied", "explicit, close up"),
  d(
    18,
    "E",
    "Emotional temperature and irony",
    "understated, cool, ironic",
    "openly emotional, earnest",
  ),
  d(
    19,
    "F",
    "Event entry",
    "told from its beginning, with setup",
    "starts late, in the middle of the action",
  ),
  d(20, "F", "Event exit", "carried through to outcome and aftermath", "cut at or before the peak"),
  d(
    21,
    "F",
    "Peak treatment",
    "compressed, skipped or told after the fact",
    "slowed down and expanded, beat by beat",
  ),
  d(22, "F", "Action granularity", "actions given as outcomes", "every step of an action"),
  d(23, "F", "Feeling rendering", "feelings named and explained", "feelings never named"),
  d(24, "F", "Interior access", "no access to thoughts", "continuous inner life"),
  d(
    25,
    "F",
    "Explanation and reader inference",
    "causes and motives spelled out",
    "much left unsaid",
  ),
  d(
    26,
    "F",
    "Dialogue subtext",
    "characters say what they mean",
    "the meaning runs under the words",
  ),
  d(
    27,
    "G",
    "Scene length",
    "many short scenes, a page or less",
    "few long scenes over many pages",
  ),
  d(28, "G", "Scene opening", "orientation first", "opens on an action, a line or a gesture"),
  d(
    29,
    "G",
    "Scene ending",
    "closes on a resolution, summary or reflection",
    "cuts on an image, a line or a question",
  ),
  d(30, "G", "Transitions", "bridged by summary, time continuous", "hard cuts and white space"),
  d(
    31,
    "G",
    "Scene focus",
    "one purpose and one main beat",
    "several threads braided in one scene",
  ),
]);

/** Dimensions a language layer may offset from the core, by at most ±1. */
export const LANGUAGE_SENSITIVE: readonly number[] = Object.freeze([4, 5, 6, 7, 11]);

/** Dimensions set per scene card rather than tuned per chapter. */
export const SCENE_LEVEL: readonly number[] = Object.freeze([19, 20, 27, 28, 29, 30]);

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export function dimension(number: number): Dimension {
  const found = DIMENSIONS.find((dim) => dim.number === number);
  if (!found) throw new RangeError(`No style dimension ${number}`);
  return found;
}
