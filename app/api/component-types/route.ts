import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { componentTypes, garmentParts, partRoles } from "@/lib/db/schema";
import { eq, and, asc, type SQL } from "drizzle-orm";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const garmentPartSlug = searchParams.get("garmentPart");

    const conditions: SQL[] = [];

    if (garmentPartSlug) {
      const gp = await db
        .select({ id: garmentParts.id })
        .from(garmentParts)
        .where(eq(garmentParts.slug, garmentPartSlug))
        .limit(1);
      if (gp.length === 0) {
        return NextResponse.json([]);
      }
      conditions.push(eq(componentTypes.garmentPartId, gp[0].id));
    }

    const rows = await db
      .select({
        id: componentTypes.id,
        name: componentTypes.name,
        slug: componentTypes.slug,
        garmentPartId: componentTypes.garmentPartId,
        garmentPartName: garmentParts.name,
        garmentPartSlug: garmentParts.slug,
        partRoleSlug: partRoles.slug,
        partRoleSortOrder: partRoles.sortOrder,
      })
      .from(componentTypes)
      .leftJoin(garmentParts, eq(componentTypes.garmentPartId, garmentParts.id))
      .leftJoin(partRoles, eq(garmentParts.partRoleId, partRoles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(componentTypes.name));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[component-types] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
