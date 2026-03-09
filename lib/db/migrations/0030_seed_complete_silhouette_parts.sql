-- Add complete-silhouette garment parts (one-piece alternatives to separates).
-- These are structural anchors: selecting one clears all other components.

INSERT INTO "garment_parts" ("name", "slug", "part_role_id", "is_anchor")
VALUES
  ('Dress Silhouette', 'dress-silhouette',
    (SELECT "id" FROM "part_roles" WHERE "slug" = 'structural'), true),
  ('Top Silhouette', 'top-silhouette',
    (SELECT "id" FROM "part_roles" WHERE "slug" = 'structural'), true),
  ('Skirt Silhouette', 'skirt-silhouette',
    (SELECT "id" FROM "part_roles" WHERE "slug" = 'structural'), true)
ON CONFLICT ("slug") DO NOTHING;

-- Link complete-silhouette parts to their garment types
-- Dress gets dress-silhouette (alongside existing bodice+skirt+sleeve path)
INSERT INTO "garment_type_parts" ("garment_type_id", "garment_part_id")
SELECT gt."id", gp."id"
FROM "garment_types" gt, "garment_parts" gp
WHERE gt."slug" = 'dress' AND gp."slug" = 'dress-silhouette'
ON CONFLICT DO NOTHING;

-- Top gets top-silhouette (alongside existing bodice+sleeve path)
INSERT INTO "garment_type_parts" ("garment_type_id", "garment_part_id")
SELECT gt."id", gp."id"
FROM "garment_types" gt, "garment_parts" gp
WHERE gt."slug" = 'top' AND gp."slug" = 'top-silhouette'
ON CONFLICT DO NOTHING;

-- Skirt gets skirt-silhouette (alongside existing skirt-section path)
INSERT INTO "garment_type_parts" ("garment_type_id", "garment_part_id")
SELECT gt."id", gp."id"
FROM "garment_types" gt, "garment_parts" gp
WHERE gt."slug" = 'skirt' AND gp."slug" = 'skirt-silhouette'
ON CONFLICT DO NOTHING;
