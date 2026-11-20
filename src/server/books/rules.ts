/** Standing rules: rich-text bodies, numbered by order, dated by their last change. */
import { and, count, eq } from "drizzle-orm";
import { LIMITS, MoveDirection, moveWithin } from "@/shared/books";
import { RULE_MAX_CHARS, parseRichText, textLength } from "@/shared/rich-text";
import { NotFound, type Actor } from "../auth/actor";
import { standingRule } from "../db/schema";
import { booksLog, checkLimit, idOf, withBook, writeOrder, type Tx } from "./core";

const parseBody = (body: unknown) =>
  parseRichText(body, { maxChars: RULE_MAX_CHARS, required: true });

async function ruleIn(tx: Tx, bookId: string, ruleId: unknown) {
  const [row] = await tx
    .select({ id: standingRule.id })
    .from(standingRule)
    .where(and(eq(standingRule.id, idOf(ruleId)), eq(standingRule.bookId, bookId)));
  if (!row) throw new NotFound();
  return row;
}

const ruleIds = async (tx: Tx, bookId: string) =>
  (
    await tx
      .select({ id: standingRule.id })
      .from(standingRule)
      .where(eq(standingRule.bookId, bookId))
      .orderBy(standingRule.position)
  ).map((r) => r.id);

export async function addRule(
  actor: Actor,
  bookId: unknown,
  body: unknown,
): Promise<{ id: string }> {
  const doc = parseBody(body);
  return withBook(actor, bookId, "books.addRule", async (tx, owned) => {
    const [n] = await tx
      .select({ n: count() })
      .from(standingRule)
      .where(eq(standingRule.bookId, owned.id));
    checkLimit(n?.n ?? 0, LIMITS.rules, "rules", "standing rules");
    const [row] = await tx
      .insert(standingRule)
      .values({ bookId: owned.id, body: doc, position: n?.n ?? 0 })
      .returning({ id: standingRule.id });
    if (!row) throw new Error("rule insert returned nothing");
    booksLog().info(
      {
        event: "book.rule.added",
        userId: actor.userId,
        bookId: owned.id,
        ruleId: row.id,
        chars: textLength(doc),
      },
      "standing rule added",
    );
    return row;
  });
}

export async function updateRule(
  actor: Actor,
  bookId: unknown,
  ruleId: unknown,
  body: unknown,
): Promise<void> {
  const doc = parseBody(body);
  await withBook(actor, bookId, "books.updateRule", async (tx, owned) => {
    const rule = await ruleIn(tx, owned.id, ruleId);
    await tx
      .update(standingRule)
      .set({ body: doc, updatedAt: new Date() })
      .where(eq(standingRule.id, rule.id));
    booksLog().info(
      {
        event: "book.rule.updated",
        userId: actor.userId,
        bookId: owned.id,
        ruleId: rule.id,
        chars: textLength(doc),
      },
      "standing rule updated",
    );
  });
}

export async function moveRule(
  actor: Actor,
  bookId: unknown,
  ruleId: unknown,
  direction: unknown,
): Promise<void> {
  const dir = MoveDirection.parse(direction);
  await withBook(actor, bookId, "books.moveRule", async (tx, owned) => {
    const rule = await ruleIn(tx, owned.id, ruleId);
    const order = moveWithin(await ruleIds(tx, owned.id), rule.id, dir);
    if (!order) return;
    await writeOrder(tx, standingRule, order);
    booksLog().info(
      {
        event: "book.rule.moved",
        userId: actor.userId,
        bookId: owned.id,
        ruleId: rule.id,
        position: order.indexOf(rule.id),
      },
      "standing rule moved",
    );
  });
}

export async function removeRule(actor: Actor, bookId: unknown, ruleId: unknown): Promise<void> {
  await withBook(actor, bookId, "books.removeRule", async (tx, owned) => {
    const rule = await ruleIn(tx, owned.id, ruleId);
    await tx.delete(standingRule).where(eq(standingRule.id, rule.id));
    await writeOrder(tx, standingRule, await ruleIds(tx, owned.id));
    booksLog().info(
      { event: "book.rule.removed", userId: actor.userId, bookId: owned.id, ruleId: rule.id },
      "standing rule removed",
    );
  });
}
