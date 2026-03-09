-- Backfill garment_part on components (denormalized from component_types → garment_parts).
-- The Drizzle schema defines this column but it was missing from this DB instance.
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "garment_part" varchar(20);

UPDATE "components" c
SET "garment_part" = gp."slug"
FROM "component_types" ct
JOIN "garment_parts" gp ON gp."id" = ct."garment_part_id"
WHERE c."component_type_id" = ct."id";

--> statement-breakpoint

-- Rename component_meshes.variant → fabric_weight to match Drizzle schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'component_meshes' AND column_name = 'variant'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'component_meshes' AND column_name = 'fabric_weight'
  ) THEN
    ALTER TABLE "component_meshes" RENAME COLUMN "variant" TO "fabric_weight";
  END IF;
END $$;
