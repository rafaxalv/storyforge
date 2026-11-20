CREATE TABLE "book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"one_liner" text DEFAULT '' NOT NULL,
	"length_target" integer,
	"length_limit" integer,
	"people_notes" text DEFAULT '' NOT NULL,
	"truth_labels" jsonb NOT NULL,
	"id_scheme" text DEFAULT 'cowriter-v1' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_language" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"written_first" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"part_id" uuid,
	"code" text NOT NULL,
	"titles" jsonb NOT NULL,
	"position" integer NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"body" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"titles" jsonb NOT NULL,
	"position" integer NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "standing_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"body" jsonb NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "book_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_language" ADD CONSTRAINT "book_language_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept" ADD CONSTRAINT "concept_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part" ADD CONSTRAINT "part_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_rule" ADD CONSTRAINT "standing_rule_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_owner_updated_idx" ON "book" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "book_language_code_uq" ON "book_language" USING btree ("book_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "book_language_written_first_uq" ON "book_language" USING btree ("book_id") WHERE "book_language"."written_first";--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_code_uq" ON "chapter" USING btree ("book_id","code");--> statement-breakpoint
CREATE INDEX "chapter_book_part_idx" ON "chapter" USING btree ("book_id","part_id","position");--> statement-breakpoint
CREATE INDEX "part_book_idx" ON "part" USING btree ("book_id","position");--> statement-breakpoint
CREATE INDEX "standing_rule_book_idx" ON "standing_rule" USING btree ("book_id","position");