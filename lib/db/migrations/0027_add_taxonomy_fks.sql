-- Add garment_part_id to component_types (nullable initially for data migration)
ALTER TABLE "component_types" ADD COLUMN IF NOT EXISTS "garment_part_id" uuid;

-- Populate garment_part_id from existing garment_part enum values
UPDATE "component_types"
SET "garment_part_id" = gp."id"
FROM "garment_parts" gp
WHERE "component_types"."garment_part" = gp."slug";

-- For rows where garment_part was NULL, try to infer from design_stage if it still exists
-- (design_stage was dropped in an earlier migration on some DB instances)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'component_types' AND column_name = 'design_stage'
  ) THEN
    UPDATE "component_types"
    SET "garment_part_id" = gp."id"
    FROM "garment_parts" gp
    WHERE "component_types"."garment_part_id" IS NULL
      AND "component_types"."design_stage" = gp."slug";
  END IF;
END $$;

-- Add FK constraint (garment_part_id should now be populated for all rows)
ALTER TABLE "component_types"
  ADD CONSTRAINT "component_types_garment_part_id_garment_parts_id_fk"
  FOREIGN KEY ("garment_part_id") REFERENCES "garment_parts"("id")
  ON DELETE no action ON UPDATE no action;

-- Add garment_type_id to silhouette_templates (nullable initially for data migration)
ALTER TABLE "silhouette_templates" ADD COLUMN IF NOT EXISTS "garment_type_id" uuid;

-- Populate garment_type_id from existing category_id by matching category name to garment_type slug
UPDATE "silhouette_templates" st
SET "garment_type_id" = gt."id"
FROM "categories" c, "garment_types" gt
WHERE st."category_id" = c."id"
  AND LOWER(c."name") = LOWER(gt."name");

-- If name matching didn't work, try slug matching
UPDATE "silhouette_templates" st
SET "garment_type_id" = gt."id"
FROM "categories" c, "garment_types" gt
WHERE st."category_id" = c."id"
  AND st."garment_type_id" IS NULL
  AND c."slug" = gt."slug";

-- Add FK constraint
ALTER TABLE "silhouette_templates"
  ADD CONSTRAINT "silhouette_templates_garment_type_id_garment_types_id_fk"
  FOREIGN KEY ("garment_type_id") REFERENCES "garment_types"("id")
  ON DELETE no action ON UPDATE no action;
