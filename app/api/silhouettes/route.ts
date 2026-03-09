import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  silhouetteTemplates,
  silhouetteComponents,
  garmentTypes,
  components,
  silhouetteTags,
  tagValues,
  tagDimensions,
} from "@/lib/db/schema";
import { eq, and, inArray, type SQL } from "drizzle-orm";

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
    const garmentTypeSlug = searchParams.get("garmentType");
    const tagSlugs = searchParams.get("tags");

    const conditions: SQL[] = [];

    if (garmentTypeSlug) {
      const gt = await db
        .select({ id: garmentTypes.id })
        .from(garmentTypes)
        .where(eq(garmentTypes.slug, garmentTypeSlug))
        .limit(1);
      if (gt.length === 0) {
        return NextResponse.json([]);
      }
      conditions.push(eq(silhouetteTemplates.garmentTypeId, gt[0].id));
    }

    // Fetch silhouettes
    const silhouettes = await db
      .select({
        id: silhouetteTemplates.id,
        name: silhouetteTemplates.name,
        patternId: silhouetteTemplates.patternId,
        garmentTypeId: silhouetteTemplates.garmentTypeId,
        basePrice: silhouetteTemplates.basePrice,
        description: silhouetteTemplates.description,
      })
      .from(silhouetteTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    if (silhouettes.length === 0) {
      return NextResponse.json([]);
    }

    const silhouetteIds = silhouettes.map((s) => s.id);

    // Fetch component assignments for all silhouettes
    const compAssignments = await db
      .select({
        silhouetteId: silhouetteComponents.silhouetteId,
        componentId: silhouetteComponents.componentId,
        componentName: components.name,
        componentAssetCode: components.assetCode,
      })
      .from(silhouetteComponents)
      .innerJoin(components, eq(silhouetteComponents.componentId, components.id))
      .where(inArray(silhouetteComponents.silhouetteId, silhouetteIds));

    // Fetch tags for all silhouettes
    const tagAssignments = await db
      .select({
        silhouetteId: silhouetteTags.silhouetteId,
        tagValueId: tagValues.id,
        tagLabel: tagValues.label,
        tagSlug: tagValues.slug,
        dimensionName: tagDimensions.name,
        dimensionSlug: tagDimensions.slug,
      })
      .from(silhouetteTags)
      .innerJoin(tagValues, eq(silhouetteTags.tagValueId, tagValues.id))
      .innerJoin(tagDimensions, eq(tagValues.dimensionId, tagDimensions.id))
      .where(inArray(silhouetteTags.silhouetteId, silhouetteIds));

    // If filtering by tags, find matching silhouette IDs
    let filteredIds: Set<string> | null = null;
    if (tagSlugs) {
      const requestedSlugs = tagSlugs.split(",").filter(Boolean);
      filteredIds = new Set<string>();
      for (const sil of silhouettes) {
        const silTags = tagAssignments
          .filter((t) => t.silhouetteId === sil.id)
          .map((t) => t.tagSlug);
        if (requestedSlugs.every((slug) => silTags.includes(slug))) {
          filteredIds.add(sil.id);
        }
      }
    }

    // Assemble response
    const result = silhouettes
      .filter((s) => (filteredIds ? filteredIds.has(s.id) : true))
      .map((s) => ({
        ...s,
        components: compAssignments
          .filter((c) => c.silhouetteId === s.id)
          .map((c) => ({
            id: c.componentId,
            name: c.componentName,
            assetCode: c.componentAssetCode,
          })),
        tags: tagAssignments
          .filter((t) => t.silhouetteId === s.id)
          .map((t) => ({
            dimension: t.dimensionSlug,
            dimensionName: t.dimensionName,
            value: t.tagSlug,
            label: t.tagLabel,
          })),
      }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[silhouettes] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
