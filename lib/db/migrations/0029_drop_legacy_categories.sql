-- Drop legacy columns from component_types
ALTER TABLE "component_types" DROP COLUMN IF EXISTS "category_id";
ALTER TABLE "component_types" DROP COLUMN IF EXISTS "design_stage";
ALTER TABLE "component_types" DROP COLUMN IF EXISTS "is_anchor";
ALTER TABLE "component_types" DROP COLUMN IF EXISTS "garment_part";

-- Drop legacy column from silhouette_templates
ALTER TABLE "silhouette_templates" DROP COLUMN IF EXISTS "category_id";

-- Drop the categories table
DROP TABLE IF EXISTS "categories";
