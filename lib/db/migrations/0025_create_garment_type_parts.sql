CREATE TABLE IF NOT EXISTS "garment_type_parts" (
  "garment_type_id" uuid NOT NULL,
  "garment_part_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "garment_type_parts_garment_type_id_garment_part_id_pk" PRIMARY KEY("garment_type_id","garment_part_id"),
  CONSTRAINT "garment_type_parts_garment_type_id_garment_types_id_fk" FOREIGN KEY ("garment_type_id") REFERENCES "garment_types"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "garment_type_parts_garment_part_id_garment_parts_id_fk" FOREIGN KEY ("garment_part_id") REFERENCES "garment_parts"("id") ON DELETE cascade ON UPDATE no action
);
