CREATE TABLE IF NOT EXISTS "garment_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "garment_types_name_unique" UNIQUE("name"),
  CONSTRAINT "garment_types_slug_unique" UNIQUE("slug")
);
