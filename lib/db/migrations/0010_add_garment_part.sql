-- Component schema updates: mesh variants, typed compatibility, garment parts
-- Apply with: npx drizzle-kit migrate
-- After applying, run: npx drizzle-kit generate (interactively) to resync the Drizzle snapshot.

-- 1. components: drop model_path, add legacy_code
ALTER TABLE "components" DROP COLUMN IF EXISTS "model_path";
--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "legacy_code" varchar(20);
--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_legacy_code_unique" UNIQUE("legacy_code");
--> statement-breakpoint

-- 2. component_types: add garment_part
ALTER TABLE "component_types" ADD COLUMN "garment_part" varchar(20);
--> statement-breakpoint

-- 3. component_meshes: new table (one row per heavy/light variant per component)
CREATE TABLE "component_meshes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"variant" varchar(20) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_meshes_component_id_variant_unique" UNIQUE("component_id","variant")
);
--> statement-breakpoint
ALTER TABLE "component_meshes" ADD CONSTRAINT "component_meshes_component_id_components_id_fk"
  FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "component_meshes_component_variant_idx" ON "component_meshes" ("component_id","variant");
--> statement-breakpoint

-- 4. component_compatibility: drop and replace with typed tables
DROP TABLE IF EXISTS "component_compatibility";
--> statement-breakpoint

CREATE TABLE "bodice_skirt_compatibility" (
	"bodice_id" uuid NOT NULL,
	"skirt_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bodice_skirt_compatibility_bodice_id_skirt_id_pk" PRIMARY KEY("bodice_id","skirt_id")
);
--> statement-breakpoint
ALTER TABLE "bodice_skirt_compatibility" ADD CONSTRAINT "bodice_skirt_compatibility_bodice_id_components_id_fk"
  FOREIGN KEY ("bodice_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bodice_skirt_compatibility" ADD CONSTRAINT "bodice_skirt_compatibility_skirt_id_components_id_fk"
  FOREIGN KEY ("skirt_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE TABLE "bodice_sleeve_compatibility" (
	"bodice_id" uuid NOT NULL,
	"sleeve_id" uuid NOT NULL,
	"sleeve_style_code" varchar(5),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bodice_sleeve_compatibility_bodice_id_sleeve_id_pk" PRIMARY KEY("bodice_id","sleeve_id")
);
--> statement-breakpoint
ALTER TABLE "bodice_sleeve_compatibility" ADD CONSTRAINT "bodice_sleeve_compatibility_bodice_id_components_id_fk"
  FOREIGN KEY ("bodice_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bodice_sleeve_compatibility" ADD CONSTRAINT "bodice_sleeve_compatibility_sleeve_id_components_id_fk"
  FOREIGN KEY ("sleeve_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- 5. fabric_skins: rename model_type → mesh_variant
ALTER TABLE "fabric_skins" RENAME COLUMN "model_type" TO "mesh_variant";
--> statement-breakpoint

-- 6. silhouette_templates: add is_composable
ALTER TABLE "silhouette_templates" ADD COLUMN "is_composable" boolean DEFAULT true NOT NULL;
