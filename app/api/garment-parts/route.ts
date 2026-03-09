import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { garmentParts, partRoles } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: garmentParts.id,
        name: garmentParts.name,
        slug: garmentParts.slug,
        partRoleId: garmentParts.partRoleId,
        partRoleName: partRoles.name,
        partRoleSlug: partRoles.slug,
        isAnchor: garmentParts.isAnchor,
      })
      .from(garmentParts)
      .innerJoin(partRoles, eq(garmentParts.partRoleId, partRoles.id))
      .orderBy(asc(partRoles.sortOrder), asc(garmentParts.name));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[garment-parts] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
