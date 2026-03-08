import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { fabricCategories, fabrics } from "@/lib/db/schema";
import { eq, and, isNull, inArray, asc } from "drizzle-orm";
import { getCompatibleFabrics } from "@/lib/compatibility";

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
    const compatibleWith = searchParams.get("compatible_with");

    // If compatible_with is provided, delegate to the compatibility engine
    if (compatibleWith) {
      const selectedIds = compatibleWith.split(",").filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const flatCats = await getCompatibleFabrics(db as any, selectedIds);

      if (flatCats.length === 0) return NextResponse.json([]);

      // Group child categories under their parents to match unfiltered tree shape
      const parentIds = [
        ...new Set(
          flatCats.filter((c) => c.parentId).map((c) => c.parentId as string),
        ),
      ];

      if (parentIds.length === 0) {
        // Top-level categories — return as-is with empty children
        return NextResponse.json(
          flatCats.map((c) => ({ ...c, children: [] })),
        );
      }

      const parents = await db
        .select({
          id: fabricCategories.id,
          name: fabricCategories.name,
          slug: fabricCategories.slug,
          merchandisingOrder: fabricCategories.merchandisingOrder,
        })
        .from(fabricCategories)
        .where(inArray(fabricCategories.id, parentIds))
        .orderBy(asc(fabricCategories.merchandisingOrder));

      const childByParent = new Map<
        string,
        { id: string; name: string; slug: string; skins: typeof flatCats[0]["skins"] }[]
      >();
      for (const cat of flatCats) {
        if (!cat.parentId) continue;
        const group = childByParent.get(cat.parentId) ?? [];
        group.push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          skins: cat.skins,
        });
        childByParent.set(cat.parentId, group);
      }

      const tree = parents.map((p) => ({
        ...p,
        children: childByParent.get(p.id) ?? [],
      }));

      return NextResponse.json(tree);
    }

    // Full 2-level tree: parent categories → child categories → leaf fabrics
    const parents = await db
      .select({
        id: fabricCategories.id,
        name: fabricCategories.name,
        slug: fabricCategories.slug,
        merchandisingOrder: fabricCategories.merchandisingOrder,
      })
      .from(fabricCategories)
      .where(
        and(
          isNull(fabricCategories.parentId),
          eq(fabricCategories.hidden, false),
        ),
      )
      .orderBy(asc(fabricCategories.merchandisingOrder));

    const tree = [];

    for (const parent of parents) {
      const children = await db
        .select({
          id: fabricCategories.id,
          name: fabricCategories.name,
          slug: fabricCategories.slug,
          merchandisingOrder: fabricCategories.merchandisingOrder,
        })
        .from(fabricCategories)
        .where(
          and(
            eq(fabricCategories.parentId, parent.id),
            eq(fabricCategories.hidden, false),
          ),
        )
        .orderBy(asc(fabricCategories.merchandisingOrder));

      const childrenWithFabrics = [];
      for (const child of children) {
        const childFabrics = await db
          .select({
            id: fabrics.id,
            name: fabrics.name,
            fabricCode: fabrics.fabricCode,
            fabricWeight: fabrics.fabricWeight,
            priceMarkup: fabrics.priceMarkup,
          })
          .from(fabrics)
          .where(
            and(
              eq(fabrics.categoryId, child.id),
              eq(fabrics.hidden, false),
            ),
          );

        childrenWithFabrics.push({ ...child, skins: childFabrics });
      }

      tree.push({ ...parent, children: childrenWithFabrics });
    }

    return NextResponse.json(tree);
  } catch (err) {
    console.error("[fabric-categories] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
