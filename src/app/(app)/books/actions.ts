"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createBook, deleteBook, updateProfile, updateTruthLabels } from "@/server/books/books";
import { getConcept, saveConcept } from "@/server/books/concept";
import {
  addLanguage,
  moveLanguage,
  removeLanguage,
  renameLanguage,
  setWrittenFirst,
} from "@/server/books/languages";
import { addRule, moveRule, removeRule, updateRule } from "@/server/books/rules";
import {
  createChapter,
  createPart,
  moveChapter,
  moveChapterToPart,
  movePart,
  removeChapter,
  removePart,
  renameChapter,
  renamePart,
  restoreChapter,
  restorePart,
} from "@/server/books/structure";
import type { RichDoc } from "@/shared/rich-text";
import { bookAction, int, str, titlesFrom, type ActionState } from "./action-result";

// ------------------------------------------------------------------ books

export async function createBookAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id = "";
  const state = await bookAction("books.create", undefined, async (actor) => {
    id = (
      await createBook(actor, {
        title: str(form, "title"),
        languageCode: str(form, "languageCode"),
        languageName: str(form, "languageName"),
      })
    ).id;
  });
  if (state.error) return state;
  redirect(`/books/${id}`);
}

export async function updateProfileAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const bookId = str(form, "bookId");
  return bookAction("books.updateProfile", bookId, async (actor) =>
    updateProfile(
      actor,
      bookId,
      {
        title: str(form, "title"),
        oneLiner: str(form, "oneLiner"),
        lengthTarget: str(form, "lengthTarget"),
        lengthLimit: str(form, "lengthLimit"),
        peopleNotes: str(form, "peopleNotes"),
      },
      int(form, "version"),
    ),
  );
}

export async function saveTruthLabelsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const bookId = str(form, "bookId");
  const reset = str(form, "intent") === "reset";
  const labels = form.getAll("label").map(String);
  return bookAction("books.updateTruthLabels", bookId, async (actor) =>
    updateTruthLabels(actor, bookId, labels, int(form, "version"), { reset }),
  );
}

export async function deleteBookAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const bookId = str(form, "bookId");
  const state = await bookAction("books.delete", undefined, (actor) =>
    deleteBook(actor, bookId, str(form, "confirmation")),
  );
  if (state.error) return state;
  redirect("/");
}

// ------------------------------------------------------------------ languages

export async function addLanguageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const bookId = str(form, "bookId");
  return bookAction("books.addLanguage", bookId, async (actor) => {
    await addLanguage(actor, bookId, { code: str(form, "code"), name: str(form, "name") });
  });
}

export async function renameLanguageAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const bookId = str(form, "bookId");
  return bookAction("books.renameLanguage", bookId, (actor) =>
    renameLanguage(actor, bookId, str(form, "id"), str(form, "name")),
  );
}

// ------------------------------------------------------------------ rules

export async function saveRuleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const bookId = str(form, "bookId");
  const ruleId = str(form, "id");
  const body = str(form, "body");
  return bookAction(ruleId ? "books.updateRule" : "books.addRule", bookId, async (actor) => {
    if (ruleId) await updateRule(actor, bookId, ruleId, body);
    else await addRule(actor, bookId, body);
  });
}

// ------------------------------------------------------------------ parts and chapters

export async function savePartAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const bookId = str(form, "bookId");
  const partId = str(form, "id");
  return bookAction(partId ? "books.renamePart" : "books.createPart", bookId, async (actor) => {
    if (partId) await renamePart(actor, bookId, partId, titlesFrom(form));
    else await createPart(actor, bookId, titlesFrom(form));
  });
}

export async function saveChapterAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const bookId = str(form, "bookId");
  const chapterId = str(form, "id");
  return bookAction(
    chapterId ? "books.renameChapter" : "books.createChapter",
    bookId,
    async (actor) => {
      if (chapterId) await renameChapter(actor, bookId, chapterId, titlesFrom(form));
      else
        await createChapter(actor, bookId, {
          code: str(form, "code"),
          titles: titlesFrom(form),
          partId: str(form, "partId"),
        });
    },
  );
}

// ------------------------------------------------------------------ item operations

/**
 * One action for the small buttons on list items (move, remove, restore, written-first),
 * so each works as a plain form without JavaScript. `op` is checked against this list.
 */
const ITEM_OPS = {
  "language.up": (a, b, id) => moveLanguage(a, b, id, "up"),
  "language.down": (a, b, id) => moveLanguage(a, b, id, "down"),
  "language.first": (a, b, id) => setWrittenFirst(a, b, id),
  "language.remove": (a, b, id) => removeLanguage(a, b, id),
  "rule.up": (a, b, id) => moveRule(a, b, id, "up"),
  "rule.down": (a, b, id) => moveRule(a, b, id, "down"),
  "rule.remove": (a, b, id) => removeRule(a, b, id),
  "part.up": (a, b, id) => movePart(a, b, id, "up"),
  "part.down": (a, b, id) => movePart(a, b, id, "down"),
  "part.remove": (a, b, id) => removePart(a, b, id),
  "part.restore": (a, b, id) => restorePart(a, b, id),
  "chapter.up": (a, b, id) => moveChapter(a, b, id, "up"),
  "chapter.down": (a, b, id) => moveChapter(a, b, id, "down"),
  "chapter.toPart": (a, b, id, form) => moveChapterToPart(a, b, id, str(form, "partId")),
  "chapter.remove": (a, b, id) => removeChapter(a, b, id),
  "chapter.restore": (a, b, id) => restoreChapter(a, b, id),
} satisfies Record<
  string,
  (
    actor: Parameters<typeof moveLanguage>[0],
    bookId: string,
    id: string,
    form: FormData,
  ) => Promise<unknown>
>;

const ItemOp = z.enum(Object.keys(ITEM_OPS) as [keyof typeof ITEM_OPS]);

export async function itemAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const bookId = str(form, "bookId");
  const op = ItemOp.safeParse(form.get("op"));
  if (!op.success) return { error: "Unknown action." };
  return bookAction(`books.${op.data}`, bookId, async (actor) => {
    await ITEM_OPS[op.data](actor, bookId, str(form, "id"), form);
  });
}

// ------------------------------------------------------------------ concept

export interface ConceptState extends ActionState {
  body?: RichDoc;
}

export async function loadConceptAction(bookId: string): Promise<ConceptState> {
  return bookAction<ConceptState>("books.getConcept", undefined, async (actor) => {
    const c = await getConcept(actor, bookId);
    return { version: c.version, body: c.body };
  });
}

export async function saveConceptAction(
  bookId: string,
  body: unknown,
  version: number,
): Promise<ActionState> {
  // No revalidation: the editor already shows what was saved.
  return bookAction("books.saveConcept", undefined, async (actor) =>
    saveConcept(actor, bookId, body, version),
  );
}
