ALTER TABLE "better_auth_users" ADD COLUMN "preferred_locale" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "approval_note" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "processed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_processed_by_user_id_better_auth_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."better_auth_users"("id") ON DELETE no action ON UPDATE no action;