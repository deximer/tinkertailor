-- Add garment_part to components, denormalized from component_types
ALTER TABLE components ADD COLUMN garment_part varchar(20);

-- Backfill from component_types
UPDATE components c
SET garment_part = ct.garment_part
FROM component_types ct
WHERE c.component_type_id = ct.id;
