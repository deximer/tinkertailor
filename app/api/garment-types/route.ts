import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { garmentTypes } from "@/lib/db/schema";
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
        id: garmentTypes.id,
        name: garmentTypes.name,
        slug: garmentTypes.slug,
      })
      .from(garmentTypes)
      .orderBy(asc(garmentTypes.name));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[garment-types] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
