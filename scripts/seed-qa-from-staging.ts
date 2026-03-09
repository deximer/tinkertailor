#!/usr/bin/env npx tsx
/**
 * Copies all DB tables and Supabase Storage from staging to QA.
 *
 * Run via: ./infra/seed-qa.sh
 * Or directly: STAGING_DATABASE_URL=... QA_DATABASE_URL=... npx tsx scripts/seed-qa-from-staging.ts
 */

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Usage: npx tsx scripts/seed-qa-from-staging.ts [options]

Copies all DB tables and Supabase Storage from staging to QA.
Prefer running via ./infra/seed-qa.sh which sets the required env vars.

Options:
  --db-only        Copy database only, skip storage
  --storage-only   Copy storage only, skip database
  --help, -h       Show this help

Required env vars:
  STAGING_DATABASE_URL        Direct Postgres URL for staging
  STAGING_SUPABASE_URL        Supabase project URL for staging
  STAGING_SERVICE_ROLE_KEY    Supabase service role key for staging
  QA_DATABASE_URL             Direct Postgres URL for QA
  QA_SUPABASE_URL             Supabase project URL for QA
  QA_SERVICE_ROLE_KEY         Supabase service role key for QA

Note: Supabase Auth users are not copied. Tables with FK constraints to
auth.users (profiles, invite_codes, creator_applications) will be skipped
with a warning. All other tables including products and orders are copied.
`);
  process.exit(0);
}

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const dbOnly = process.argv.includes("--db-only");
const storageOnly = process.argv.includes("--storage-only");

// ── Env validation ────────────────────────────────────────────────────────────

const required = [
  "STAGING_DATABASE_URL",
  "STAGING_SUPABASE_URL",
  "STAGING_SERVICE_ROLE_KEY",
  "QA_DATABASE_URL",
  "QA_SUPABASE_URL",
  "QA_SERVICE_ROLE_KEY",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const {
  STAGING_DATABASE_URL,
  STAGING_SUPABASE_URL,
  STAGING_SERVICE_ROLE_KEY,
  QA_DATABASE_URL,
  QA_SUPABASE_URL,
  QA_SERVICE_ROLE_KEY,
} = process.env as Record<string, string>;

// ── Clients ───────────────────────────────────────────────────────────────────

const stagingDb = postgres(STAGING_DATABASE_URL, { max: 1, ssl: "require" });
const qaDb = postgres(QA_DATABASE_URL, { max: 1, ssl: "require" });

const stagingSupabase = createClient(
  STAGING_SUPABASE_URL,
  STAGING_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const qaSupabase = createClient(QA_SUPABASE_URL, QA_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Database copy ─────────────────────────────────────────────────────────────

// Tables in insertion order so FK constraints are satisfied.
// profiles/invite_codes/creator_applications reference auth.users (not copied)
// and will be skipped with a warning.
const TABLE_ORDER = [
  "part_roles",
  "garment_types",
  "garment_parts",
  "garment_type_parts",
  "tag_dimensions",
  "component_types",
  "tag_values",
  "fabric_categories", // self-referencing via parent_id — handled below
  "silhouette_templates",
  "components",
  "fabrics",
  "silhouette_components",
  "silhouette_tags",
  "component_fabric_rules",
  "component_compatibility",
  "profiles",              // will fail — FK to auth.users (not copied)
  "invite_codes",          // will fail — FK to profiles
  "creator_applications",  // will fail — FK to profiles
  "products",
  "product_components",
  "orders",
  "shipments",
  "attribution_links",
  "attribution_visits",
];

async function copyTable(table: string): Promise<void> {
  const rows = await stagingDb`SELECT * FROM ${stagingDb(table)}`;

  if (rows.length === 0) {
    console.log(`  ${table}: (empty)`);
    return;
  }

  // fabric_categories is self-referencing: insert root nodes first
  if (table === "fabric_categories") {
    const roots = rows.filter((r) => (r as any).parent_id === null);
    const children = rows.filter((r) => (r as any).parent_id !== null);
    if (roots.length > 0) {
      await qaDb`INSERT INTO fabric_categories ${qaDb(roots as any[])} ON CONFLICT DO NOTHING`;
    }
    if (children.length > 0) {
      await qaDb`INSERT INTO fabric_categories ${qaDb(children as any[])} ON CONFLICT DO NOTHING`;
    }
    console.log(`  ${table}: ${rows.length} rows`);
    return;
  }

  try {
    await qaDb`INSERT INTO ${qaDb(table)} ${qaDb(rows as any[])} ON CONFLICT DO NOTHING`;
    console.log(`  ${table}: ${rows.length} rows`);
  } catch (err: any) {
    // FK violations on auth-dependent tables are expected — surface clearly
    const isFkViolation = err.code === "23503";
    if (isFkViolation) {
      console.warn(
        `  ⚠ ${table}: skipped — FK constraint (auth.users not copied). Create QA users manually.`
      );
    } else {
      console.warn(`  ⚠ ${table}: insert failed — ${err.message}`);
    }
  }
}

async function copyDatabase(): Promise<void> {
  console.log("\n── Database ──────────────────────────────────────────");

  console.log("Truncating QA tables...");
  const tableList = [...TABLE_ORDER]
    .reverse()
    .map((t) => `"${t}"`)
    .join(", ");
  await qaDb.unsafe(`TRUNCATE TABLE ${tableList} CASCADE`);

  console.log("Copying from staging...");
  for (const table of TABLE_ORDER) {
    await copyTable(table);
  }
}

// ── Storage copy ──────────────────────────────────────────────────────────────

async function listAllFiles(
  bucket: string,
  path = ""
): Promise<string[]> {
  const { data, error } = await stagingSupabase.storage
    .from(bucket)
    .list(path, { limit: 1000 });

  if (error) throw new Error(`list ${bucket}/${path}: ${error.message}`);
  if (!data) return [];

  const files: string[] = [];
  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (item.id === null) {
      // Folder — recurse
      files.push(...(await listAllFiles(bucket, fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function copyBucket(bucket: string): Promise<void> {
  const files = await listAllFiles(bucket);
  if (files.length === 0) {
    console.log(`  ${bucket}: (empty)`);
    return;
  }
  console.log(`  ${bucket}: ${files.length} files`);

  let copied = 0;
  let failed = 0;

  for (const file of files) {
    const { data, error: dlErr } = await stagingSupabase.storage
      .from(bucket)
      .download(file);

    if (dlErr || !data) {
      console.warn(`    ⚠ download failed: ${file} — ${dlErr?.message}`);
      failed++;
      continue;
    }

    const { error: ulErr } = await qaSupabase.storage
      .from(bucket)
      .upload(file, data, { upsert: true });

    if (ulErr) {
      console.warn(`    ⚠ upload failed: ${file} — ${ulErr.message}`);
      failed++;
      continue;
    }

    copied++;
  }

  console.log(`    ${copied} copied, ${failed} failed`);
}

async function copyStorage(): Promise<void> {
  console.log("\n── Storage ───────────────────────────────────────────");

  const { data: stagingBuckets, error } =
    await stagingSupabase.storage.listBuckets();
  if (error) throw new Error(`Failed to list staging buckets: ${error.message}`);

  const { data: qaBuckets } = await qaSupabase.storage.listBuckets();
  const qaBucketNames = new Set(qaBuckets?.map((b) => b.name) ?? []);

  for (const bucket of stagingBuckets ?? []) {
    if (!qaBucketNames.has(bucket.name)) {
      const { error: createErr } = await qaSupabase.storage.createBucket(
        bucket.name,
        { public: bucket.public }
      );
      if (createErr) {
        console.warn(
          `  ⚠ failed to create bucket "${bucket.name}": ${createErr.message}`
        );
        continue;
      }
    }
    await copyBucket(bucket.name);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Seeding QA from staging...");
  if (!storageOnly) await copyDatabase();
  if (!dbOnly) await copyStorage();
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("\nFatal:", err.message);
    process.exit(1);
  })
  .finally(() => {
    stagingDb.end();
    qaDb.end();
  });
