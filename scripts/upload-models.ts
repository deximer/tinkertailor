/**
 * Upload OBJ mesh files to Supabase Storage and seed component_meshes table.
 *
 * Source: nogit/assets/seed-data/components.json (mesh paths)
 *         nogit/assets/models-patterns/ (actual OBJ files)
 *
 * Usage:
 *   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/upload-models.ts
 *
 * Or with env file:
 *   node --env-file=.env.qa ./node_modules/.bin/tsx scripts/upload-models.ts
 *
 * Storage layout: bucket "models", path "{COMPONENT_CODE}/{variant}.obj"
 *   e.g. BOD-27/heavy.obj, SK-1/light.obj
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { components, componentMeshes } from "../lib/db/schema";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

const BUCKET = "models";
const MODELS_ROOT = path.resolve("nogit/assets/models-patterns");
const SEED_DATA_PATH = path.resolve("nogit/assets/seed-data/components.json");

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeshEntry {
  variant: string;
  filename: string;
  path: string;
}

interface ComponentEntry {
  code: string;
  name: string;
  type: string;
  meshes: MeshEntry[];
}

interface SeedData {
  bodices: ComponentEntry[];
  skirts: ComponentEntry[];
  sleeves: ComponentEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 50 * 1024 * 1024, // 50 MB per file
    });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`  Created storage bucket "${BUCKET}"`);
  } else {
    console.log(`  Bucket "${BUCKET}" already exists`);
  }
}

async function uploadMesh(
  componentCode: string,
  mesh: MeshEntry,
): Promise<string | null> {
  const localPath = path.join(MODELS_ROOT, mesh.path);
  if (!fs.existsSync(localPath)) {
    console.warn(`    MISSING: ${mesh.path}`);
    return null;
  }

  const storagePath = `${componentCode}/${mesh.variant}.obj`;
  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: "model/obj",
      upsert: true,
    });

  if (error) {
    console.warn(`    UPLOAD ERROR (${storagePath}): ${error.message}`);
    return null;
  }

  return storagePath;
}

type MeshVariant = "heavy" | "light" | "standard";

async function upsertComponentMesh(
  componentId: string,
  variant: MeshVariant,
  storagePath: string,
) {
  const existing = await db
    .select({ id: componentMeshes.id })
    .from(componentMeshes)
    .where(
      and(
        eq(componentMeshes.componentId, componentId),
        eq(componentMeshes.variant, variant),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(componentMeshes)
      .set({ storagePath })
      .where(eq(componentMeshes.id, existing[0].id));
  } else {
    await db.insert(componentMeshes).values({
      componentId,
      variant: variant as "heavy" | "light" | "standard",
      storagePath,
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Upload Models to Supabase Storage ===\n");

  const seedData = JSON.parse(fs.readFileSync(SEED_DATA_PATH, "utf-8")) as SeedData;
  const allComponents = [
    ...seedData.bodices,
    ...seedData.skirts,
    ...seedData.sleeves,
  ];

  await ensureBucket();
  console.log();

  let uploaded = 0;
  let skipped = 0;
  let meshRows = 0;

  for (const comp of allComponents) {
    if (comp.meshes.length === 0) continue;

    // Find the component in DB by legacy_code
    const [dbComp] = await db
      .select({ id: components.id })
      .from(components)
      .where(eq(components.legacyCode, comp.code))
      .limit(1);

    if (!dbComp) {
      console.warn(`  Component not in DB: ${comp.code} (${comp.name}) — run seed-components.ts first`);
      skipped++;
      continue;
    }

    console.log(`  ${comp.code} ${comp.name} (${comp.meshes.length} meshes)`);

    for (const mesh of comp.meshes) {
      const storagePath = await uploadMesh(comp.code, mesh);
      if (!storagePath) {
        skipped++;
        continue;
      }

      await upsertComponentMesh(dbComp.id, mesh.variant as MeshVariant, storagePath);
      console.log(`    ✓ ${mesh.variant} → ${storagePath}`);
      uploaded++;
      meshRows++;
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`  ${uploaded} files uploaded to storage`);
  console.log(`  ${meshRows} component_meshes rows upserted`);
  if (skipped > 0) console.log(`  ${skipped} skipped (missing files or components)`);

  await client.end();
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
