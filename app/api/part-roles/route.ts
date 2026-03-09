import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { partRoles } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

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
        id: partRoles.id,
        name: partRoles.name,
        slug: partRoles.slug,
        sortOrder: partRoles.sortOrder,
      })
      .from(partRoles)
      .orderBy(asc(partRoles.sortOrder));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[part-roles] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
