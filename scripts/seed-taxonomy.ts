/**
 * Seed script for tag taxonomy dimensions/values and silhouette templates.
 *
 * Sources:
 *   - nogit/assets/docx/Final tagging of dress blocks January 6, 2026.docx
 *     (13 tag dimensions with all valid values)
 *   - nogit/assets/docx/Tagging of dress silhouettes new conversation Jan 7, 2026.docx
 *     (silhouette entries with full tagging across all 13 dimensions)
 *
 * Usage: node --env-file=.env.local ./node_modules/.bin/tsx scripts/seed-taxonomy.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import mammoth from "mammoth";
import path from "path";
import {
  categories,
  tagDimensions,
  tagValues,
  silhouetteTemplates,
  silhouetteComponents,
  silhouetteTags,
  components,
} from "../lib/db/schema";
import type { TagSelectionType } from "../lib/db/schema/tags";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Tag Dimension Definitions (from taxonomy DOCX)
// ---------------------------------------------------------------------------

interface DimensionDef {
  name: string;
  slug: string;
  selectionType: TagSelectionType;
  values: string[];
}

const DIMENSIONS: DimensionDef[] = [
  {
    name: "Core Silhouette",
    slug: "core-silhouette",
    selectionType: "single",
    values: [
      "A-line", "Fit-and-Flare", "Sheath", "Column", "Mermaid",
      "Empire", "Drop-Waist", "Shift", "Wrap", "Ballgown",
      "Trapeze", "Peplum", "Slip", "Tunic", "Sculptural / Architectural",
    ],
  },
  {
    name: "Length",
    slug: "length",
    selectionType: "single",
    values: ["Mini", "Above Knee", "Knee Length", "Midi", "Tea Length", "Maxi", "Floor Length"],
  },
  {
    name: "Waist Position",
    slug: "waist-position",
    selectionType: "single",
    values: ["Natural Waist", "Empire Waist", "Drop Waist", "No Defined Waist"],
  },
  {
    name: "Shoulder Construction",
    slug: "shoulder-construction",
    selectionType: "single",
    values: [
      "Standard Shoulder", "Off-Shoulder", "Drop Shoulder",
      "Max Drop Shoulder", "One-Shoulder", "Halter / Neck-Held",
      "Strapless", "Cold Shoulder",
    ],
  },
  {
    name: "Sleeve Type",
    slug: "sleeve-type",
    selectionType: "multi",
    values: [
      "Sleeveless", "Cap", "Short", "Elbow", "3/4", "Long",
      "Fitted", "Straight", "Bell", "Flare", "Puff", "Bishop",
      "Dolman", "Kimono", "Cape", "Detached",
    ],
  },
  {
    name: "Neckline / Back Details",
    slug: "neckline-back",
    selectionType: "multi",
    values: [
      "Crew", "Scoop", "V-neck", "Sweetheart", "Halter", "Boat",
      "Square", "High Neck", "Asymmetric",
      "Closed Back", "Low Back", "Open Back", "Cutout Back",
      "Keyhole Back", "Cross-Back", "Lace-Up Back",
    ],
  },
  {
    name: "Detail Features",
    slug: "detail-features",
    selectionType: "multi",
    values: [
      "Cutouts (side / back)", "Slit (front / side / back)", "Ruching",
      "Draping", "Pleats", "Gathering", "Peplum", "Ruffles",
      "Asymmetry", "Architectural seaming",
    ],
  },
  {
    name: "Body Cues",
    slug: "body-cues",
    selectionType: "multi",
    values: [
      "Hides shoulders", "Frames shoulders", "Reveals shoulders",
      "Reveals back", "Hides arms", "Highlights arms", "Hides knees",
      "Hides hips", "Accentuates waist", "Accentuates bust",
      "Accentuates butt", "Accentuates legs", "Accentuates curves",
      "Creates vertical line", "Softens silhouette", "Structured shaping",
    ],
  },
  {
    name: "Body Shape Optimization",
    slug: "body-shape",
    selectionType: "multi",
    values: [
      "Hourglass", "Pear", "Apple", "Rectangle",
      "Inverted Triangle", "Petite", "Tall",
    ],
  },
  {
    name: "Aesthetic Mood",
    slug: "aesthetic-mood",
    selectionType: "multi",
    values: [
      "Timeless", "Contemporary", "Modern Romantic", "Sexy", "Minimal",
      "Architectural", "Sculptural", "Soft Feminine", "Bold", "Dramatic",
      "Playful", "Elegant", "Goth", "Grunge", "Ethereal",
    ],
  },
  {
    name: "Era References",
    slug: "era-references",
    selectionType: "multi",
    values: [
      "Timeless", "1920s", "1930s", "1940s", "1950s", "1960s",
      "1970s", "1980s", "1990s", "Y2K", "Early 2000s", "2010s",
      "Modern / 2020s",
    ],
  },
  {
    name: "Occasion",
    slug: "occasion",
    selectionType: "multi",
    values: [
      "Everyday", "Business Casual", "Work", "Cocktail", "Party",
      "Clubbing", "Date Night", "Meet the Parents", "Bridesmaid",
      "Wedding Guest", "Black Tie", "Formal Evening", "Holiday",
      "Beach", "Resort", "Art Opening", "Art Festival", "Concert",
      "Burning Man", "Fancy Sports (Polo / Races)",
    ],
  },
  {
    name: "Designer Inspiration",
    slug: "designer-inspiration",
    selectionType: "multi",
    values: [
      "Chanel-inspired", "Halston-inspired", "Tom Ford-inspired",
      "Alaia-inspired", "Calvin Klein-inspired", "Dior-inspired",
      "Givenchy-inspired", "Saint Laurent-inspired", "McQueen-inspired",
      "Phoebe Philo-era Celine-inspired",
    ],
  },
];

// ---------------------------------------------------------------------------
// Step 1: Seed tag dimensions and values
// ---------------------------------------------------------------------------

async function seedDimensions() {
  console.log("Seeding tag dimensions and values...");

  // dimensionSlug -> { dimId, valueSlug -> valueId }
  const dimMap: Record<string, { id: string; values: Record<string, string> }> = {};

  for (let i = 0; i < DIMENSIONS.length; i++) {
    const dim = DIMENSIONS[i];

    // Upsert dimension
    const existing = await db
      .select()
      .from(tagDimensions)
      .where(eq(tagDimensions.slug, dim.slug))
      .limit(1);

    let dimId: string;
    if (existing.length > 0) {
      dimId = existing[0].id;
    } else {
      const inserted = await db
        .insert(tagDimensions)
        .values({
          name: dim.name,
          slug: dim.slug,
          selectionType: dim.selectionType,
          displayOrder: i + 1,
        })
        .returning();
      dimId = inserted[0].id;
    }

    const valueMap: Record<string, string> = {};

    for (let j = 0; j < dim.values.length; j++) {
      const label = dim.values[j];
      const valSlug = slugify(label);

      const existingVal = await db
        .select()
        .from(tagValues)
        .where(
          and(eq(tagValues.dimensionId, dimId), eq(tagValues.slug, valSlug)),
        )
        .limit(1);

      if (existingVal.length > 0) {
        valueMap[valSlug] = existingVal[0].id;
      } else {
        const inserted = await db
          .insert(tagValues)
          .values({
            dimensionId: dimId,
            label,
            slug: valSlug,
            displayOrder: j + 1,
          })
          .returning();
        valueMap[valSlug] = inserted[0].id;
      }
    }

    dimMap[dim.slug] = { id: dimId, values: valueMap };
  }

  const totalValues = Object.values(dimMap).reduce(
    (sum, d) => sum + Object.keys(d.values).length, 0,
  );
  console.log(`  ${DIMENSIONS.length} dimensions, ${totalValues} values seeded.`);
  return dimMap;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Step 2: Parse silhouettes from DOCX
// ---------------------------------------------------------------------------

interface ParsedSilhouette {
  name: string;
  patternId: string;
  tags: Record<string, string[]>; // dimension name -> tag value labels
}

async function parseSilhouetteDocx(): Promise<ParsedSilhouette[]> {
  const docPath = path.resolve(
    "nogit/assets/docx/Tagging of dress silhouettes new conversation Jan 7, 2026.docx",
  );
  const result = await mammoth.extractRawText({ path: docPath });
  const text = result.value;

  const silhouettes: ParsedSilhouette[] = [];

  // Split by "IDENTIFICATION" markers
  const blocks = text.split(/(?=IDENTIFICATION)/);

  for (const block of blocks) {
    const nameMatch = block.match(/Style Name:\s*(.+)/);
    const numMatch = block.match(/Style Number:\s*(TT-PAT-SIL[\w-]+)/);
    if (!nameMatch || !numMatch) continue;

    const sil: ParsedSilhouette = {
      name: nameMatch[1].trim(),
      patternId: numMatch[1].trim(),
      tags: {},
    };

    // Parse each numbered section
    const sections = [
      { num: "1", dim: "core-silhouette" },
      { num: "2", dim: "length" },
      { num: "3", dim: "waist-position" },
      { num: "4", dim: "shoulder-construction" },
      { num: "5", dim: "sleeve-type" },
      { num: "6", dim: "neckline-back" },
      { num: "7", dim: "detail-features" },
      { num: "8", dim: "body-cues" },
      { num: "9", dim: "body-shape" },
      { num: "10", dim: "aesthetic-mood" },
      { num: "11", dim: "era-references" },
      { num: "12", dim: "occasion" },
      { num: "13", dim: "designer-inspiration" },
    ];

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const nextNum = i < sections.length - 1 ? sections[i + 1].num : null;

      // Find section start
      const startPattern = new RegExp(`${sec.num}\\.\\s+[A-Z]`);
      const startMatch = block.search(startPattern);
      if (startMatch === -1) continue;

      // Find section end
      let endIdx: number;
      if (nextNum) {
        const endPattern = new RegExp(`${nextNum}\\.\\s+[A-Z]`);
        const endMatch = block.substring(startMatch + 5).search(endPattern);
        endIdx = endMatch === -1 ? block.length : startMatch + 5 + endMatch;
      } else {
        endIdx = block.length;
      }

      const sectionText = block.substring(startMatch, endIdx);
      const values = extractTagValues(sectionText, sec.dim);
      if (values.length > 0) {
        sil.tags[sec.dim] = values;
      }
    }

    silhouettes.push(sil);
  }

  return silhouettes;
}

function extractTagValues(sectionText: string, dimSlug: string): string[] {
  const lines = sectionText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Skip header lines (numbered section title, sub-labels like "Sleeve Length:", "Neckline:", etc.)
  const skipPatterns = [
    /^\d+\.\s/,
    /^Sleeve Length:$/,
    /^Sleeve Shape:$/,
    /^Neckline:$/,
    /^Back Design:$/,
    /^Single-select$/,
    /^Multi-select/,
    /^Primary:/,
    /^Secondary:/,
  ];

  const values: string[] = [];

  for (const line of lines) {
    // Skip headers and labels
    if (skipPatterns.some((p) => p.test(line))) {
      // But extract values from "Primary: X" and "Secondary: X" for body shape
      if (dimSlug === "body-shape") {
        const primMatch = line.match(/^Primary:\s*(.+)/);
        const secMatch = line.match(/^Secondary:\s*(.+)/);
        if (primMatch) values.push(primMatch[1].trim());
        if (secMatch) values.push(secMatch[1].trim());
      }
      continue;
    }

    // Skip section titles that contain dimension names
    if (/^(CORE SILHOUETTE|LENGTH|WAIST|SHOULDER|SLEEVE|NECKLINE|DETAIL|BODY CUE|BODY SHAPE|AESTHETIC|ERA|OCCASION|DESIGNER)/i.test(line)) {
      continue;
    }

    // Skip parenthetical notes
    if (/^\(/.test(line)) continue;

    // Clean up value
    let val = line.trim();
    // Remove trailing notes in parens: "Cutouts (back)" -> keep as is since it may match
    if (val.length > 0 && val.length < 100) {
      values.push(val);
    }
  }

  return values;
}

// ---------------------------------------------------------------------------
// Step 3: Seed silhouettes and their tags
// ---------------------------------------------------------------------------

async function seedSilhouettes(
  dimMap: Record<string, { id: string; values: Record<string, string> }>,
  parsed: ParsedSilhouette[],
) {
  console.log(`Seeding ${parsed.length} silhouettes...`);

  // Get dress category ID
  const dressCat = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "dress"))
    .limit(1);
  if (dressCat.length === 0) {
    throw new Error("Dress category not found. Run seed-components.ts first.");
  }
  const dressId = dressCat[0].id;

  let silCount = 0;
  let tagCount = 0;

  for (const sil of parsed) {
    // Upsert silhouette template
    const existing = await db
      .select()
      .from(silhouetteTemplates)
      .where(eq(silhouetteTemplates.patternId, sil.patternId))
      .limit(1);

    let silId: string;
    if (existing.length > 0) {
      silId = existing[0].id;
    } else {
      const inserted = await db
        .insert(silhouetteTemplates)
        .values({
          name: sil.name,
          patternId: sil.patternId,
          categoryId: dressId,
          basePrice: "0",
          description: null,
        })
        .returning();
      silId = inserted[0].id;
      silCount++;
    }

    // Seed component assignments based on pattern ID
    // Pattern ID format: TT-PAT-SIL-BBB-SSS-LLL (bodice-skirt-sleeve)
    const patParts = sil.patternId.replace("TT-PAT-SIL-", "").split("-");
    if (patParts.length === 3) {
      const [bodNum, skNum, slvNum] = patParts;

      // Link bodice if non-zero
      if (bodNum !== "000") {
        const bodCode = `BOD-${parseInt(bodNum, 10)}`;
        await linkComponent(silId, bodCode);
      }

      // Link skirt if non-zero
      if (skNum !== "000") {
        const skCode = `SK-${parseInt(skNum, 10)}`;
        await linkComponent(silId, skCode);
      }

      // Link sleeve if non-zero
      if (slvNum !== "000") {
        const slvCode = `SLV-${parseInt(slvNum, 10)}`;
        await linkComponent(silId, slvCode);
      }
    }

    // Seed tags
    for (const [dimSlug, tagLabels] of Object.entries(sil.tags)) {
      const dimData = dimMap[dimSlug];
      if (!dimData) continue;

      for (const label of tagLabels) {
        const valSlug = slugify(label);

        // Try exact slug match first
        let tagValueId = dimData.values[valSlug];

        // If not found, try fuzzy match (the DOCX may use slightly different text)
        if (!tagValueId) {
          const normalized = valSlug.replace(/-inspired$/, "").replace(/-era-.*/, "");
          for (const [slug, id] of Object.entries(dimData.values)) {
            if (slug.includes(normalized) || normalized.includes(slug)) {
              tagValueId = id;
              break;
            }
          }
        }

        if (!tagValueId) {
          // Create the tag value if it doesn't exist yet (doc may have extra values)
          const inserted = await db
            .insert(tagValues)
            .values({
              dimensionId: dimData.id,
              label,
              slug: valSlug,
              displayOrder: Object.keys(dimData.values).length + 1,
            })
            .onConflictDoNothing()
            .returning();
          if (inserted.length > 0) {
            tagValueId = inserted[0].id;
            dimData.values[valSlug] = tagValueId;
          } else {
            // Already exists with different combo, skip
            continue;
          }
        }

        // Insert silhouette-tag link
        const existingTag = await db
          .select()
          .from(silhouetteTags)
          .where(
            and(
              eq(silhouetteTags.silhouetteId, silId),
              eq(silhouetteTags.tagValueId, tagValueId),
            ),
          )
          .limit(1);

        if (existingTag.length === 0) {
          await db.insert(silhouetteTags).values({
            silhouetteId: silId,
            tagValueId,
          });
          tagCount++;
        }
      }
    }
  }

  console.log(`  ${silCount} new silhouettes, ${tagCount} tag assignments seeded.`);
}

async function linkComponent(silhouetteId: string, compCode: string) {
  const comp = await db
    .select()
    .from(components)
    .where(eq(components.assetCode, compCode))
    .limit(1);
  if (comp.length === 0) return;

  const existing = await db
    .select()
    .from(silhouetteComponents)
    .where(
      and(
        eq(silhouetteComponents.silhouetteId, silhouetteId),
        eq(silhouetteComponents.componentId, comp[0].id),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(silhouetteComponents).values({
      silhouetteId,
      componentId: comp[0].id,
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Seed Taxonomy & Silhouettes ===\n");

  const dimMap = await seedDimensions();
  const parsed = await parseSilhouetteDocx();
  console.log(`Parsed ${parsed.length} silhouettes from DOCX.`);
  await seedSilhouettes(dimMap, parsed);

  console.log("\n=== Seed complete ===");
  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
