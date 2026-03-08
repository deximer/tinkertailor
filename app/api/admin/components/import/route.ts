import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { components, componentTypes } from "@/lib/db/schema";

import { requireAdmin } from "@/lib/auth/guards";

interface RowError {
  row: number;
  message: string;
}

function parseCSV(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "file field required (multipart form data)" },
        { status: 400 },
      );
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 },
      );
    }

    // Validate header row
    const header = rows[0].map((h) => h.toLowerCase());
    const nameIdx = header.indexOf("name");
    const codeIdx = header.indexOf("asset_code");
    const typeSlugIdx = header.indexOf("type_slug");

    if (nameIdx === -1 || codeIdx === -1 || typeSlugIdx === -1) {
      return NextResponse.json(
        {
          error:
            "CSV must have columns: name, asset_code, type_slug (header row required)",
        },
        { status: 400 },
      );
    }

    // Load all component types for slug lookup
    const allTypes = await db
      .select({
        id: componentTypes.id,
        slug: componentTypes.slug,
      })
      .from(componentTypes);

    const typesBySlug = new Map(allTypes.map((t) => [t.slug, t.id]));

    // Load existing component codes for duplicate detection
    const existingComponents = await db
      .select({ assetCode: components.assetCode })
      .from(components);

    const existingCodes = new Set(existingComponents.map((c) => c.assetCode));

    const dataRows = rows.slice(1);
    let created = 0;
    let skipped = 0;
    const errors: RowError[] = [];
    const seenCodesInBatch = new Set<string>();

    const toInsert: { name: string; assetCode: string; componentTypeId: string }[] =
      [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-indexed, accounting for header

      const name = row[nameIdx] ?? "";
      const code = row[codeIdx] ?? "";
      const typeSlug = row[typeSlugIdx] ?? "";

      if (!name) {
        errors.push({ row: rowNum, message: "name is required" });
        continue;
      }

      if (!code) {
        errors.push({ row: rowNum, message: "asset_code is required" });
        continue;
      }

      if (!typeSlug) {
        errors.push({ row: rowNum, message: "type_slug is required" });
        continue;
      }

      const typeId = typesBySlug.get(typeSlug);
      if (!typeId) {
        errors.push({
          row: rowNum,
          message: `unknown type_slug: ${typeSlug}`,
        });
        continue;
      }

      if (existingCodes.has(code) || seenCodesInBatch.has(code)) {
        skipped++;
        continue;
      }

      seenCodesInBatch.add(code);
      toInsert.push({ name, assetCode: code, componentTypeId: typeId });
    }

    // Batch insert valid rows
    if (toInsert.length > 0) {
      await db.insert(components).values(toInsert);
      created = toInsert.length;
    }

    return NextResponse.json({ created, skipped, errors });
  } catch (err) {
    console.error("[admin/components/import] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
