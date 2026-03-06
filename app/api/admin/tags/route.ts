import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tagDimensions, tagValues } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const [dimensions, values] = await Promise.all([
      db
        .select({
          id: tagDimensions.id,
          name: tagDimensions.name,
          slug: tagDimensions.slug,
          selectionType: tagDimensions.selectionType,
          displayOrder: tagDimensions.displayOrder,
        })
        .from(tagDimensions)
        .orderBy(asc(tagDimensions.displayOrder)),
      db
        .select({
          id: tagValues.id,
          dimensionId: tagValues.dimensionId,
          label: tagValues.label,
          slug: tagValues.slug,
          displayOrder: tagValues.displayOrder,
        })
        .from(tagValues)
        .orderBy(asc(tagValues.displayOrder)),
    ]);

    return NextResponse.json({ dimensions, values });
  } catch (err) {
    console.error("[admin/tags] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
