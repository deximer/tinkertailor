-- Drop model_path from components; replaced by component_meshes table
ALTER TABLE "components" DROP COLUMN IF EXISTS "model_path";
