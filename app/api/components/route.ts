import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { components, componentTypes, componentMeshes } from "@/lib/db/schema";
import { eq, and, inArray, type SQL } from "drizzle-orm";
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

      // Fetch mesh storagePaths for selected components (prefer "standard" weight)
      const meshMap = new Map<string, string>();
      if (result.selectedComponents.length > 0) {
        const meshRows = await db
          .select({
            componentId: componentMeshes.componentId,
            fabricWeight: componentMeshes.fabricWeight,
            storagePath: componentMeshes.storagePath,
          })
          .from(componentMeshes)
          .where(inArray(componentMeshes.componentId, result.selectedComponents.map((c) => c.id)));

        // Priority: standard > heavy > light
        const weightPriority: Record<string, number> = { standard: 0, heavy: 1, light: 2 };
        for (const row of meshRows) {
          const existing = meshMap.get(row.componentId);
          if (!existing || weightPriority[row.fabricWeight] < weightPriority[existing]) {
            meshMap.set(row.componentId, row.storagePath);
          }
        }
      }

      return NextResponse.json({
        designPhase: result.designPhase,
        components: filtered,
        selectedComponents: result.selectedComponents.map((c) => ({
          ...c,
          storagePath: meshMap.get(c.id) ?? null,
        })),
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
        assetCode: components.assetCode,
        componentTypeId: components.componentTypeId,
        typeName: componentTypes.name,
        typeSlug: componentTypes.slug,
        designStage: componentTypes.designStage,
        isAnchor: componentTypes.isAnchor,
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
