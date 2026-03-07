-- 0012_add_component_meshes.sql
-- Creates component_meshes table for storing 3D mesh variants per component.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "component_meshes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "component_id" uuid NOT NULL REFERENCES "components"("id"),
  "variant" varchar(20) NOT NULL,
  "storage_path" varchar(500) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
