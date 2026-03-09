CREATE TABLE IF NOT EXISTS "part_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "part_roles_name_unique" UNIQUE("name"),
  CONSTRAINT "part_roles_slug_unique" UNIQUE("slug")
);
