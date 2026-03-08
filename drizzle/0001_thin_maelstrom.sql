CREATE TYPE "public"."cinema_type" AS ENUM('art_house', 'circuit', 'municipal', 'independent', 'festival', 'cine_club', 'cultural_center', 'other');--> statement-breakpoint
CREATE TYPE "public"."projection_type" AS ENUM('digital', 'film_35mm', 'film_70mm');--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "cinema_type" "cinema_type";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cinemas" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "projection_type" "projection_type";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "has_dcp_equipment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "screen_format" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "sound_system" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;