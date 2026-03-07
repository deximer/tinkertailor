/**
 * Seed script for components, compatibility matrices, and fabric data.
 *
 * Sources:
 *   - nogit/assets/xls/Original TT Component Matches.xlsx
 *     Sheet "Skirts": bodice-skirt compatibility matrix
 *     Sheet "Sleeves": bodice-sleeve compatibility matrix
 *   - nogit/assets/xls/Original TT MASS Excel Fabric+Component.xlsx
 *     Sheet "Legend": fabric type names and codes
 *     Sheet "Matches": bodice-fabric × skirt-fabric compatibility
 *     Sheet "SLV": bodice-fabric × sleeve compatibility
 *
 * Usage: node --env-file=.env.local ./node_modules/.bin/tsx scripts/seed-components.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import ExcelJS from "exceljs";
import path from "path";
import {
  categories,
  componentTypes,
  components,
  bodiceSkirtCompatibility,
  bodiceSleeveCompatibility,
  fabricSkinCategories,
  fabricSkins,
  componentFabricCategories,
} from "../lib/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Upsert by unique column — insert if not exists, return existing if it does. */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function upsertBySlug(
  table: any,
  slugCol: any,
  slugVal: string,
  row: Record<string, unknown>,
): Promise<{ id: string }> {
  const existing = await db
    .select()
    .from(table)
    .where(eq(slugCol, slugVal))
    .limit(1);
  if (existing.length > 0) return existing[0] as { id: string };

  const inserted = await db.insert(table).values(row as any).returning();
  return inserted[0] as { id: string };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function upsertByCode(
  code: string,
  row: { name: string; code: string; componentTypeId: string; legacyCode?: string },
) {
  const existing = await db
    .select()
    .from(components)
    .where(eq(components.code, code))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const inserted = await db.insert(components).values(row).returning();
  return inserted[0];
}

// ---------------------------------------------------------------------------
// Step 1: Categories
// ---------------------------------------------------------------------------

async function seedCategories() {
  console.log("Seeding categories...");
  const cats = [
    { name: "Dress", slug: "dress" },
    { name: "Top", slug: "top" },
    { name: "Skirt", slug: "skirt" },
  ];

  const result: Record<string, string> = {};
  for (const cat of cats) {
    const row = await upsertBySlug(
      categories,
      categories.slug,
      cat.slug,
      cat,
    );
    result[cat.slug] = row.id;
  }
  console.log(`  ${Object.keys(result).length} categories seeded.`);
  return result;
}

// ---------------------------------------------------------------------------
// Step 2: Component Types
// ---------------------------------------------------------------------------

async function seedComponentTypes(categoryIds: Record<string, string>) {
  console.log("Seeding component types...");
  const types = [
    {
      name: "Bodice",
      slug: "bodice",
      categoryId: categoryIds.dress,
      stage: "silhouette" as const,
      isFirstLeaf: true,
    },
    {
      name: "Skirt Section",
      slug: "skirt-section",
      categoryId: categoryIds.dress,
      stage: "silhouette" as const,
      isFirstLeaf: false,
    },
    {
      name: "Sleeve",
      slug: "sleeve",
      categoryId: categoryIds.dress,
      stage: "silhouette" as const,
      isFirstLeaf: false,
    },
  ];

  const result: Record<string, string> = {};
  for (const t of types) {
    const row = await upsertBySlug(
      componentTypes,
      componentTypes.slug,
      t.slug,
      t,
    );
    result[t.slug] = row.id;
  }
  console.log(`  ${Object.keys(result).length} component types seeded.`);
  return result;
}

// ---------------------------------------------------------------------------
// Step 3: Components from spreadsheet
// ---------------------------------------------------------------------------

async function seedComponentsFromSpreadsheet(
  typeIds: Record<string, string>,
) {
  console.log("Seeding components from spreadsheet...");
  const xlsPath = path.resolve(
    "nogit/assets/xls/Original TT Component Matches.xlsx",
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsPath);

  const componentMap: Record<string, string> = {}; // code -> uuid

  // --- Bodices: read row headers from Skirts sheet ---
  const skirtsSheet = wb.getWorksheet("Skirts")!;
  const bodiceCodes: string[] = [];
  for (let r = 2; r <= skirtsSheet.rowCount; r++) {
    const val = skirtsSheet.getRow(r).getCell(1).value;
    if (val && String(val).trim().startsWith("BOD-")) {
      bodiceCodes.push(String(val).trim());
    }
  }

  for (const code of bodiceCodes) {
    const num = code.replace("BOD-", "");
    const row = await upsertByCode(code, {
      name: `Bodice ${num}`,
      code,
      componentTypeId: typeIds.bodice,
    });
    componentMap[code] = row.id;
  }
  console.log(`  ${bodiceCodes.length} bodices seeded.`);

  // --- Skirts: read column headers from Skirts sheet ---
  const skirtCodes: string[] = [];
  const headerRow = skirtsSheet.getRow(1);
  for (let c = 2; c <= skirtsSheet.columnCount; c++) {
    const val = headerRow.getCell(c).value;
    if (val && String(val).trim().startsWith("SK-")) {
      skirtCodes.push(String(val).trim());
    }
  }

  for (const code of skirtCodes) {
    const num = code.replace("SK-", "");
    const row = await upsertByCode(code, {
      name: `Skirt ${num}`,
      code,
      componentTypeId: typeIds["skirt-section"],
    });
    componentMap[code] = row.id;
  }
  console.log(`  ${skirtCodes.length} skirts seeded.`);

  // --- Sleeves: read column headers from Sleeves sheet ---
  const sleevesSheet = wb.getWorksheet("Sleeves")!;
  const sleeveCodes: string[] = [];
  const slvHeaderRow = sleevesSheet.getRow(1);
  for (let c = 2; c <= sleevesSheet.columnCount; c++) {
    const val = slvHeaderRow.getCell(c).value;
    if (val) {
      const raw = String(val).trim();
      // Headers are like "SLV-1 ST", extract just the code part
      const match = raw.match(/^(SLV-\d+)/);
      if (match) {
        const code = match[1];
        // Also extract type indicator (ST/DS/OS) for the name
        const typeIndicator = raw.replace(code, "").trim();
        sleeveCodes.push(code);

        const num = code.replace("SLV-", "");
        const typeName = typeIndicator
          ? { ST: "Standard", DS: "Dress", OS: "Open" }[typeIndicator] ||
            typeIndicator
          : "";
        const row = await upsertByCode(code, {
          name: `Sleeve ${num}${typeName ? ` (${typeName})` : ""}`,
          code,
          componentTypeId: typeIds.sleeve,
        });
        componentMap[code] = row.id;
      }
    }
  }
  console.log(`  ${sleeveCodes.length} sleeves seeded.`);

  return { componentMap, bodiceCodes, skirtCodes, sleeveCodes, wb };
}

// ---------------------------------------------------------------------------
// Step 4: Compatibility matrices
// ---------------------------------------------------------------------------

async function seedCompatibilityMatrices(
  componentMap: Record<string, string>,
  bodiceCodes: string[],
  skirtCodes: string[],
  sleeveCodes: string[],
  wb: ExcelJS.Workbook,
) {
  console.log("Seeding compatibility matrices...");

  // --- Bodice-Skirt from Skirts sheet ---
  const skirtsSheet = wb.getWorksheet("Skirts")!;
  let bodSkirtCount = 0;

  for (let r = 2; r <= skirtsSheet.rowCount; r++) {
    const bodCode = String(skirtsSheet.getRow(r).getCell(1).value || "").trim();
    if (!bodCode.startsWith("BOD-") || !componentMap[bodCode]) continue;

    for (let c = 2; c <= skirtsSheet.columnCount; c++) {
      const skCode = String(skirtsSheet.getRow(1).getCell(c).value || "").trim();
      if (!skCode.startsWith("SK-") || !componentMap[skCode]) continue;

      const val = skirtsSheet.getRow(r).getCell(c).value;
      if (Number(val) === 1) {
        const bodiceId = componentMap[bodCode];
        const skirtId = componentMap[skCode];
        // Idempotent insert
        const existing = await db
          .select()
          .from(bodiceSkirtCompatibility)
          .where(
            and(
              eq(bodiceSkirtCompatibility.bodiceId, bodiceId),
              eq(bodiceSkirtCompatibility.skirtId, skirtId),
            ),
          )
          .limit(1);
        if (existing.length === 0) {
          await db
            .insert(bodiceSkirtCompatibility)
            .values({ bodiceId, skirtId });
          bodSkirtCount++;
        }
      }
    }
  }
  console.log(`  ${bodSkirtCount} bodice-skirt compatibility edges seeded.`);

  // --- Bodice-Sleeve from Sleeves sheet ---
  const sleevesSheet = wb.getWorksheet("Sleeves")!;
  let bodSlvCount = 0;

  // Build sleeve code lookup from header
  const slvCodeByCol: Record<number, string> = {};
  const slvHeader = sleevesSheet.getRow(1);
  for (let c = 2; c <= sleevesSheet.columnCount; c++) {
    const val = slvHeader.getCell(c).value;
    if (val) {
      const match = String(val).trim().match(/^(SLV-\d+)/);
      if (match) slvCodeByCol[c] = match[1];
    }
  }

  for (let r = 2; r <= sleevesSheet.rowCount; r++) {
    const bodCode = String(sleevesSheet.getRow(r).getCell(1).value || "").trim();
    if (!bodCode.startsWith("BOD-") || !componentMap[bodCode]) continue;

    for (const [colStr, slvCode] of Object.entries(slvCodeByCol)) {
      const col = Number(colStr);
      if (!componentMap[slvCode]) continue;

      const val = sleevesSheet.getRow(r).getCell(col).value;
      if (Number(val) === 1) {
        const bodiceId = componentMap[bodCode];
        const sleeveId = componentMap[slvCode];
        const existing = await db
          .select()
          .from(bodiceSleeveCompatibility)
          .where(
            and(
              eq(bodiceSleeveCompatibility.bodiceId, bodiceId),
              eq(bodiceSleeveCompatibility.sleeveId, sleeveId),
            ),
          )
          .limit(1);
        if (existing.length === 0) {
          await db
            .insert(bodiceSleeveCompatibility)
            .values({ bodiceId, sleeveId });
          bodSlvCount++;
        }
      }
    }
  }
  console.log(`  ${bodSlvCount} bodice-sleeve compatibility edges seeded.`);
}

// ---------------------------------------------------------------------------
// Step 5: Fabric types and categories
// ---------------------------------------------------------------------------

async function seedFabrics() {
  console.log("Seeding fabric types...");
  const xlsPath = path.resolve(
    "nogit/assets/xls/Original TT MASS Excel Fabric+Component.xlsx",
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsPath);

  const legend = wb.getWorksheet("Legend")!;

  // Create top-level "All Fabrics" parent category
  const parentCat = await upsertBySlug(
    fabricSkinCategories,
    fabricSkinCategories.slug,
    "all-fabrics",
    {
      name: "All Fabrics",
      slug: "all-fabrics",
      parentId: null,
      merchandisingOrder: 0,
    },
  );

  // Group fabrics into sub-categories by material family
  const fabricFamilies: Record<
    string,
    { name: string; slug: string; order: number }
  > = {
    silk: { name: "Silk", slug: "silk", order: 1 },
    cotton: { name: "Cotton", slug: "cotton", order: 2 },
    wool: { name: "Wool", slug: "wool", order: 3 },
    specialty: { name: "Specialty", slug: "specialty", order: 4 },
  };

  const familyCats: Record<string, string> = {};
  for (const [key, fam] of Object.entries(fabricFamilies)) {
    const cat = await upsertBySlug(
      fabricSkinCategories,
      fabricSkinCategories.slug,
      fam.slug,
      {
        name: fam.name,
        slug: fam.slug,
        parentId: parentCat.id,
        merchandisingOrder: fam.order,
      },
    );
    familyCats[key] = cat.id;
  }

  // Map fabric codes to families
  const codeToFamily: Record<string, string> = {
    SC: "silk",
    CDC: "silk",
    SG: "silk",
    STF: "silk",
    STW: "silk",
    SJ: "silk",
    SV: "silk",
    CHR: "silk",
    ST: "silk",
    WL: "wool",
    WC: "wool",
    CP: "cotton",
    CS: "cotton",
    LTHR: "specialty",
    MJ: "specialty",
    LC: "specialty",
    NT: "specialty",
    CHF: "specialty",
    DS: "specialty",
    SDS: "specialty",
    CBS: "specialty",
    RV: "specialty",
    ORG: "specialty",
    GZ: "specialty",
    JAC: "specialty",
    LAM: "specialty",
  };

  // Read fabric types from Legend
  let fabricCount = 0;
  const fabricCodeToId: Record<string, string> = {};

  for (let r = 1; r <= legend.rowCount; r++) {
    const nameVal = legend.getRow(r).getCell(1).value;
    const codeVal = legend.getRow(r).getCell(2).value;
    if (!nameVal || !codeVal) continue;

    const name = String(nameVal).trim();
    const code = String(codeVal).trim();
    if (!code || code.length > 10) continue; // Skip non-code rows

    const family = codeToFamily[code] || "specialty";
    const catId = familyCats[family];

    const slug = code.toLowerCase();
    const existing = await db
      .select()
      .from(fabricSkins)
      .where(eq(fabricSkins.fabricCode, code))
      .limit(1);

    let fabricId: string;
    if (existing.length > 0) {
      fabricId = existing[0].id;
    } else {
      const inserted = await db
        .insert(fabricSkins)
        .values({
          name,
          fabricCode: code,
          categoryId: catId,
          meshVariant: null,
          priceMarkup: "0",
        })
        .returning();
      fabricId = inserted[0].id;
      fabricCount++;
    }
    fabricCodeToId[code] = fabricId;
  }
  console.log(`  ${fabricCount} fabric skins seeded.`);

  return { fabricCodeToId, wb };
}

// ---------------------------------------------------------------------------
// Step 6: Fabric affinity rules (component-fabric compatibility)
// ---------------------------------------------------------------------------

async function seedFabricAffinity(
  componentMap: Record<string, string>,
  fabricWb: ExcelJS.Workbook,
) {
  console.log("Seeding fabric affinity rules...");

  // The MASS spreadsheet Matches sheet has rows like "BO1-SC" meaning
  // bodice 1 with Silk Crepe. We extract which fabric codes are compatible
  // with each bodice by checking if ANY pairing with that fabric has a 1.
  const matches = fabricWb.getWorksheet("Matches")!;

  // Get all unique fabric codes from the row headers
  const fabricCodesUsed = new Set<string>();
  for (let r = 2; r <= matches.rowCount; r++) {
    const val = String(matches.getRow(r).getCell(1).value || "").trim();
    const parts = val.split("-");
    if (parts.length === 2) fabricCodesUsed.add(parts[1]);
  }

  // Get fabric skin category IDs for each code
  const fabricCatMap: Record<string, string> = {};
  for (const code of fabricCodesUsed) {
    const skin = await db
      .select()
      .from(fabricSkins)
      .where(eq(fabricSkins.fabricCode, code))
      .limit(1);
    if (skin.length > 0) {
      fabricCatMap[code] = skin[0].categoryId;
    }
  }

  // For BOD-1 (BO1), extract which fabric codes have any compatible pairing
  // This gives us the fabric affinity for the first bodice as a baseline
  const bodiceRow: Record<string, Set<string>> = {};

  for (let r = 2; r <= matches.rowCount; r++) {
    const rowHeader = String(matches.getRow(r).getCell(1).value || "").trim();
    const parts = rowHeader.split("-");
    if (parts.length !== 2) continue;

    const compCode = parts[0]; // e.g. "BO1"
    const fabricCode = parts[1]; // e.g. "SC"

    // Convert BO1 -> BOD-1
    const match = compCode.match(/^BO(\d+)$/);
    if (!match) continue;
    const bodCode = `BOD-${match[1]}`;
    if (!componentMap[bodCode]) continue;

    // Check if this bodice-fabric combo has any compatible pairing
    let hasMatch = false;
    for (let c = 2; c <= matches.columnCount; c++) {
      if (Number(matches.getRow(r).getCell(c).value) === 1) {
        hasMatch = true;
        break;
      }
    }

    if (hasMatch) {
      if (!bodiceRow[bodCode]) bodiceRow[bodCode] = new Set();
      bodiceRow[bodCode].add(fabricCode);
    }
  }

  // Insert component-fabric category links
  let affinityCount = 0;
  for (const [bodCode, fabricCodes] of Object.entries(bodiceRow)) {
    const compId = componentMap[bodCode];
    if (!compId) continue;

    // Get unique category IDs for compatible fabrics
    const catIds = new Set<string>();
    for (const fc of fabricCodes) {
      if (fabricCatMap[fc]) catIds.add(fabricCatMap[fc]);
    }

    for (const catId of catIds) {
      const existing = await db
        .select()
        .from(componentFabricCategories)
        .where(
          and(
            eq(componentFabricCategories.componentId, compId),
            eq(componentFabricCategories.fabricSkinCategoryId, catId),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(componentFabricCategories).values({
          componentId: compId,
          fabricSkinCategoryId: catId,
        });
        affinityCount++;
      }
    }
  }
  console.log(`  ${affinityCount} component-fabric affinity rules seeded.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Seed Components & Compatibility ===\n");

  const categoryIds = await seedCategories();
  const typeIds = await seedComponentTypes(categoryIds);
  const { componentMap, bodiceCodes, skirtCodes, sleeveCodes, wb } =
    await seedComponentsFromSpreadsheet(typeIds);
  await seedCompatibilityMatrices(
    componentMap,
    bodiceCodes,
    skirtCodes,
    sleeveCodes,
    wb,
  );
  const { fabricCodeToId, wb: fabricWb } = await seedFabrics();
  await seedFabricAffinity(componentMap, fabricWb);

  console.log("\n=== Seed complete ===");
  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
