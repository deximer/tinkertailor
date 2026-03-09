-- Seed part_roles: structural, decorative, finishing
INSERT INTO "part_roles" ("name", "slug", "sort_order")
VALUES
  ('Structural', 'structural', 0),
  ('Decorative', 'decorative', 1),
  ('Finishing', 'finishing', 2)
ON CONFLICT ("slug") DO NOTHING;

-- Seed garment_types: dress, top, skirt
INSERT INTO "garment_types" ("name", "slug")
VALUES
  ('Dress', 'dress'),
  ('Top', 'top'),
  ('Skirt', 'skirt')
ON CONFLICT ("slug") DO NOTHING;

-- Seed garment_parts: bodice, skirt, sleeve (structural); embellishment (decorative); finishing
INSERT INTO "garment_parts" ("name", "slug", "part_role_id", "is_anchor")
VALUES
  ('Bodice', 'bodice', (SELECT "id" FROM "part_roles" WHERE "slug" = 'structural'), true),
  ('Skirt', 'skirt', (SELECT "id" FROM "part_roles" WHERE "slug" = 'structural'), false),
  ('Sleeve', 'sleeve', (SELECT "id" FROM "part_roles" WHERE "slug" = 'structural'), false),
  ('Embellishment', 'embellishment', (SELECT "id" FROM "part_roles" WHERE "slug" = 'decorative'), false),
  ('Finishing', 'finishing', (SELECT "id" FROM "part_roles" WHERE "slug" = 'finishing'), false)
ON CONFLICT ("slug") DO NOTHING;

-- Seed garment_type_parts mappings
-- Dress = bodice + skirt + sleeve + embellishment + finishing
INSERT INTO "garment_type_parts" ("garment_type_id", "garment_part_id")
SELECT gt."id", gp."id"
FROM "garment_types" gt, "garment_parts" gp
WHERE gt."slug" = 'dress'
  AND gp."slug" IN ('bodice', 'skirt', 'sleeve', 'embellishment', 'finishing')
ON CONFLICT DO NOTHING;

-- Top = bodice + sleeve + embellishment + finishing
INSERT INTO "garment_type_parts" ("garment_type_id", "garment_part_id")
SELECT gt."id", gp."id"
FROM "garment_types" gt, "garment_parts" gp
WHERE gt."slug" = 'top'
  AND gp."slug" IN ('bodice', 'sleeve', 'embellishment', 'finishing')
ON CONFLICT DO NOTHING;

-- Skirt = skirt + embellishment + finishing
INSERT INTO "garment_type_parts" ("garment_type_id", "garment_part_id")
SELECT gt."id", gp."id"
FROM "garment_types" gt, "garment_parts" gp
WHERE gt."slug" = 'skirt'
  AND gp."slug" IN ('skirt', 'embellishment', 'finishing')
ON CONFLICT DO NOTHING;
