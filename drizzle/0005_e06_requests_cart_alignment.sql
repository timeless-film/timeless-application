ALTER TYPE "public"."request_status" ADD VALUE IF NOT EXISTS 'approved';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE IF NOT EXISTS 'rejected';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE IF NOT EXISTS 'cancelled';--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "end_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "end_date" DROP NOT NULL;