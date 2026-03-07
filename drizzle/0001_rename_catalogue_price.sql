-- Rename catalogue_price → catalog_price in requests and order_items tables
ALTER TABLE "requests" RENAME COLUMN "catalogue_price" TO "catalog_price";--> statement-breakpoint
ALTER TABLE "order_items" RENAME COLUMN "catalogue_price" TO "catalog_price";
