-- 0011_add_is_composable.sql
-- Adds is_composable boolean column to silhouette_templates table.

--> statement-breakpoint
ALTER TABLE "silhouette_templates" ADD COLUMN IF NOT EXISTS "is_composable" boolean NOT NULL DEFAULT false;
