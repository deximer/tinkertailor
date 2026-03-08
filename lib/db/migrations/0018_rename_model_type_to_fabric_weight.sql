-- Rename mesh_variant → fabric_weight on fabrics table.
-- (model_type was already renamed to mesh_variant in migration 0010.)
ALTER TABLE fabrics RENAME COLUMN mesh_variant TO fabric_weight;
