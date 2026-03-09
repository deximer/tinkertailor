CREATE TABLE IF NOT EXISTS "garment_parts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "part_role_id" uuid NOT NULL,
  "is_anchor" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "garment_parts_name_unique" UNIQUE("name"),
  CONSTRAINT "garment_parts_slug_unique" UNIQUE("slug"),
  CONSTRAINT "garment_parts_part_role_id_part_roles_id_fk" FOREIGN KEY ("part_role_id") REFERENCES "part_roles"("id") ON DELETE no action ON UPDATE no action
);
