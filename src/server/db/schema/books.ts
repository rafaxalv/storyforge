/**
 * Books (E02): a book and its profile, languages, standing rules, Concept, parts and
 * chapters. Everything hangs off `book`, which hangs off `user`, so deleting either removes
 * the rest by cascade. Positions are dense (0..n-1) within their list.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { RichDoc } from "@/shared/rich-text";
import { user } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Titles per book language, keyed by language code: `{ "EN": "Arrival", "PT-BR": "Chegada" }`. */
export type Titles = Record<string, string>;

export const book = pgTable(
  "book",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    oneLiner: text("one_liner").notNull().default(""),
    lengthTarget: integer("length_target"),
    lengthLimit: integer("length_limit"),
    peopleNotes: text("people_notes").notNull().default(""),
    truthLabels: jsonb("truth_labels").$type<string[]>().notNull(),
    idScheme: text("id_scheme").notNull().default("cowriter-v1"),
    version: integer("version").notNull().default(1),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("book_owner_updated_idx").on(t.ownerId, t.updatedAt.desc())],
);

export const bookLanguage = pgTable(
  "book_language",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    writtenFirst: boolean("written_first").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("book_language_code_uq").on(t.bookId, t.code),
    uniqueIndex("book_language_written_first_uq")
      .on(t.bookId)
      .where(sql`${t.writtenFirst}`),
  ],
);

export const standingRule = pgTable(
  "standing_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    body: jsonb("body").$type<RichDoc>().notNull(),
    position: integer("position").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("standing_rule_book_idx").on(t.bookId, t.position)],
);

export const concept = pgTable("concept", {
  bookId: uuid("book_id")
    .primaryKey()
    .references(() => book.id, { onDelete: "cascade" }),
  body: jsonb("body").$type<RichDoc>().notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const part = pgTable(
  "part",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    titles: jsonb("titles").$type<Titles>().notNull(),
    position: integer("position").notNull(),
    removedAt: ts("removed_at"),
  },
  (t) => [index("part_book_idx").on(t.bookId, t.position)],
);

export const chapter = pgTable(
  "chapter",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    partId: uuid("part_id").references(() => part.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    titles: jsonb("titles").$type<Titles>().notNull(),
    position: integer("position").notNull(),
    removedAt: ts("removed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chapter_code_uq").on(t.bookId, t.code),
    index("chapter_book_part_idx").on(t.bookId, t.partId, t.position),
  ],
);
