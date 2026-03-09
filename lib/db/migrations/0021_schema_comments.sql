-- Schema design comments: document rationale alongside the tables themselves.

-- bodice_skirt_compatibility
COMMENT ON TABLE "bodice_skirt_compatibility" IS
  'Valid bodice+skirt waistline pairings (natural or empire waist join). '
  'Kept separate from bodice_sleeve_compatibility because sleeve pairings carry '
  'a sleeve_style_code (attachment geometry) with no equivalent at the waistline. '
  'Source: nogit/assets/xls/Original TT Component Matches.xlsx, Skirts sheet.';

-- bodice_sleeve_compatibility
COMMENT ON TABLE "bodice_sleeve_compatibility" IS
  'Valid bodice+sleeve shoulder pairings. The sleeve_style_code column (attachment '
  'geometry) is the primary reason this is a separate table from '
  'bodice_skirt_compatibility — that metadata does not exist for waistline joins. '
  'Source: nogit/assets/xls/Original TT Component Matches.xlsx, Sleeves sheet.';

COMMENT ON COLUMN "bodice_sleeve_compatibility"."sleeve_style_code" IS
  'Shoulder attachment geometry required by this pairing: '
  'ST = set-in (standard), DS = drop-shoulder, OS = off-shoulder.';
