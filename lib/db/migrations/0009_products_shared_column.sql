-- 0009_products_shared_column.sql
-- Adds shared boolean column to products for public creator profile visibility.

--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shared" boolean NOT NULL DEFAULT false;
