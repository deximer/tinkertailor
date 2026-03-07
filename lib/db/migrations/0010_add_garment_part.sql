-- 0010_add_garment_part.sql
-- Adds garment_part column to component_types table.

--> statement-breakpoint
ALTER TABLE "component_types" ADD COLUMN IF NOT EXISTS "garment_part" varchar(20);
