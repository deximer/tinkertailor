import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { componentTypes, categories } from "@/lib/db/schema";
import { eq, and, asc, type SQL } from "drizzle-orm";
import type { ComponentDesignStage } from "@/lib/db/schema/component-types";

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
    const categorySlug = searchParams.get("category");
    const stage = searchParams.get("stage");

    const conditions: SQL[] = [];

    if (categorySlug) {
      const cat = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      if (cat.length === 0) {
        return NextResponse.json([]);
      }
      conditions.push(eq(componentTypes.categoryId, cat[0].id));
    }

    if (stage) {
      conditions.push(eq(componentTypes.designStage, stage as ComponentDesignStage));
    }

    const rows = await db
      .select({
        id: componentTypes.id,
        name: componentTypes.name,
        slug: componentTypes.slug,
        categoryId: componentTypes.categoryId,
        designStage: componentTypes.designStage,
        isAnchor: componentTypes.isAnchor,
        garmentPart: componentTypes.garmentPart,
      })
      .from(componentTypes)
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
