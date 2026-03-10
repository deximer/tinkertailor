import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { bodiceSkirtCompatibility, bodiceSleeveCompatibility } from "@/lib/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [skirtRows, sleeveRows] = await Promise.all([
    db.select({ bodiceId: bodiceSkirtCompatibility.bodiceId, count: count() })
      .from(bodiceSkirtCompatibility)
      .groupBy(bodiceSkirtCompatibility.bodiceId),
    db.select({ bodiceId: bodiceSleeveCompatibility.bodiceId, count: count() })
      .from(bodiceSleeveCompatibility)
      .groupBy(bodiceSleeveCompatibility.bodiceId),
  ]);

  const result: Record<string, { skirts: number; sleeves: number }> = {};
  for (const row of skirtRows) {
    result[row.bodiceId] = { skirts: row.count, sleeves: 0 };
  }
  for (const row of sleeveRows) {
    if (result[row.bodiceId]) {
      result[row.bodiceId].sleeves = row.count;
    } else {
      result[row.bodiceId] = { skirts: 0, sleeves: row.count };
    }
  }

  return NextResponse.json(result);
}
