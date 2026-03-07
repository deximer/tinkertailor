import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { components, componentTypes } from "@/lib/db/schema";
import { eq, and, type SQL } from "drizzle-orm";
import { getCompatibleComponents } from "@/lib/compatibility";

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
    const typeSlug = searchParams.get("type");
    const compatibleWith = searchParams.get("compatible_with");

    // If compatible_with is provided, delegate to the compatibility engine
    if (compatibleWith) {
      const selectedIds = compatibleWith.split(",").filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getCompatibleComponents(db as any, selectedIds);

      let filtered = result.components;
      if (typeSlug) {
        filtered = filtered.filter((c) => c.typeSlug === typeSlug);
      }

      return NextResponse.json({
        designPhase: result.designPhase,
        components: filtered,
        selectedComponents: result.selectedComponents,
      });
    }

    // Simple component listing with optional type filter
    const conditions: SQL[] = [];
    if (typeSlug) {
      conditions.push(eq(componentTypes.slug, typeSlug));
    }

    const rows = await db
      .select({
        id: components.id,
        name: components.name,
        code: components.code,
        componentTypeId: components.componentTypeId,
        typeName: componentTypes.name,
        typeSlug: componentTypes.slug,
        stage: componentTypes.stage,
        isFirstLeaf: componentTypes.isFirstLeaf,
      })
      .from(components)
      .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[components] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
