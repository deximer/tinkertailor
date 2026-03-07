/**
 * Seed silhouette templates from the component mesh inventory.
 *
 * Strategy: one composable silhouette per bodice that has mesh files.
 * Bodices paired with skirts → "Dress" category.
 * Bodices without compatible skirts → "Top" category.
 *
 * Each silhouette gets the bodice as its default component (via
 * silhouette_components). Skirt and sleeve are user-selected at design time.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/seed-silhouettes.ts
 *   node --env-file=.env.qa ./node_modules/.bin/tsx scripts/seed-silhouettes.ts
 *
 * Safe to re-run — idempotent on pattern_id.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import fs from "fs";
import path from "path";
import {
  categories,
  components,
  silhouetteTemplates,
  silhouetteComponents,
  bodiceSkirtCompatibility,
} from "../lib/db/schema";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const SEED_DATA_PATH = path.resolve("nogit/assets/seed-data/components.json");

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPatternId(code: string): string {
  // BOD-27 → "BOD-27", BOD-82 → "BOD-82"
  return `PAT-${code}`;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Seed Silhouette Templates ===\n");

  const seedData = JSON.parse(fs.readFileSync(SEED_DATA_PATH, "utf-8")) as {
    bodices: { code: string; name: string }[];
  };

  // Resolve category IDs
  const [dressCat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, "dress"))
    .limit(1);
  const [topCat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, "top"))
    .limit(1);

  if (!dressCat || !topCat) {
    throw new Error("Categories not found — run seed-components.ts first");
  }

  // Get all bodices with mesh files from the DB (have legacyCode set)
  const bodiceLegacyCodes = seedData.bodices.map((b) => b.code);
  const dbBodices = await db
    .select({ id: components.id, legacyCode: components.legacyCode, name: components.name })
    .from(components)
    .where(inArray(components.legacyCode, bodiceLegacyCodes));

  if (dbBodices.length === 0) {
    throw new Error("No bodice components found in DB — run seed-components.ts first");
  }

  // For each bodice, check if it has compatible skirts
  const bodiceIdsWithSkirts = new Set<string>();
  for (const bodice of dbBodices) {
    const [skirtEdge] = await db
      .select({ bodiceId: bodiceSkirtCompatibility.bodiceId })
      .from(bodiceSkirtCompatibility)
      .where(eq(bodiceSkirtCompatibility.bodiceId, bodice.id))
      .limit(1);
    if (skirtEdge) bodiceIdsWithSkirts.add(bodice.id);
  }

  let created = 0;
  let skipped = 0;

  for (const bodice of dbBodices) {
    const patternId = toPatternId(bodice.legacyCode!);
    const hasSkirts = bodiceIdsWithSkirts.has(bodice.id);
    const categoryId = hasSkirts ? dressCat.id : topCat.id;
    const silhouetteName = hasSkirts
      ? `${bodice.name} Dress`
      : `${bodice.name} Top`;

    // Check if silhouette already exists
    const [existing] = await db
      .select({ id: silhouetteTemplates.id })
      .from(silhouetteTemplates)
      .where(eq(silhouetteTemplates.patternId, patternId))
      .limit(1);

    let silhouetteId: string;

    if (existing) {
      silhouetteId = existing.id;
      skipped++;
    } else {
      const [inserted] = await db
        .insert(silhouetteTemplates)
        .values({
          name: silhouetteName,
          patternId,
          categoryId,
          basePrice: "0",
          isComposable: true,
        })
        .returning({ id: silhouetteTemplates.id });

      silhouetteId = inserted.id;
      created++;
      console.log(`  ✓ ${silhouetteName} (${patternId})`);
    }

    // Ensure bodice is linked as a default component
    const [linkedComp] = await db
      .select({ silhouetteId: silhouetteComponents.silhouetteId })
      .from(silhouetteComponents)
      .where(
        eq(silhouetteComponents.silhouetteId, silhouetteId),
      )
      .limit(1);

    if (!linkedComp) {
      await db.insert(silhouetteComponents).values({
        silhouetteId,
        componentId: bodice.id,
        defaultFabricSkinId: null,
      });
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`  ${created} silhouette templates created`);
  console.log(`  ${skipped} already existed`);

  await client.end();
}

main().catch((err) => {
  console.error("Silhouette seed failed:", err);
  process.exit(1);
});
