ALTER TABLE "order_items" ADD COLUMN "original_catalog_price" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "original_currency" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "exchange_rate" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "original_catalog_price" integer;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "original_currency" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "exchange_rate" text;