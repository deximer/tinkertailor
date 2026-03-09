-- Make legacy columns nullable so new API routes can skip them.
-- These columns will be dropped entirely in a later migration.

ALTER TABLE "component_types" ALTER COLUMN "category_id" DROP NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'component_types' AND column_name = 'design_stage'
  ) THEN
    ALTER TABLE "component_types" ALTER COLUMN "design_stage" DROP NOT NULL;
  END IF;
END $$;

-- silhouette_templates.category_id also needs to be nullable
ALTER TABLE "silhouette_templates" ALTER COLUMN "category_id" DROP NOT NULL;
