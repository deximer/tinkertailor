-- Re-add model_path to components (dropped in 0010, back in schema for design/3D routing)
ALTER TABLE components ADD COLUMN IF NOT EXISTS model_path varchar(500);
