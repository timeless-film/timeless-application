ALTER TABLE "order_items" ADD COLUMN "lab_order_number" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "delivery_urgency_days_before_start" integer DEFAULT 5 NOT NULL;