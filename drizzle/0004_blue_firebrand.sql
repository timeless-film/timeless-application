CREATE TYPE "public"."film_event_type" AS ENUM('view', 'cart_add');--> statement-breakpoint
CREATE TABLE "film_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"event_type" "film_event_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"search_term" text,
	"filters" jsonb,
	"result_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "film_events" ADD CONSTRAINT "film_events_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_events" ADD CONSTRAINT "film_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "film_events_film_id_idx" ON "film_events" USING btree ("film_id");--> statement-breakpoint
CREATE INDEX "film_events_account_id_idx" ON "film_events" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "film_events_type_idx" ON "film_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "film_events_created_at_idx" ON "film_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_events_account_id_idx" ON "search_events" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "search_events_created_at_idx" ON "search_events" USING btree ("created_at");