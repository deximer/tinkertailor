import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { fabricSkinCategories, fabricSkins } from "@/lib/db/schema";
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
          id: fabricSkinCategories.id,
          name: fabricSkinCategories.name,
          slug: fabricSkinCategories.slug,
          merchandisingOrder: fabricSkinCategories.merchandisingOrder,
        })
        .from(fabricSkinCategories)
        .where(inArray(fabricSkinCategories.id, parentIds))
        .orderBy(asc(fabricSkinCategories.merchandisingOrder));

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

    // Full 2-level tree: parent categories → child categories → leaf skins
    const parents = await db
      .select({
        id: fabricSkinCategories.id,
        name: fabricSkinCategories.name,
        slug: fabricSkinCategories.slug,
        merchandisingOrder: fabricSkinCategories.merchandisingOrder,
      })
      .from(fabricSkinCategories)
      .where(
        and(
          isNull(fabricSkinCategories.parentId),
          eq(fabricSkinCategories.hidden, false),
        ),
      )
      .orderBy(asc(fabricSkinCategories.merchandisingOrder));

    const tree = [];

    for (const parent of parents) {
      const children = await db
        .select({
          id: fabricSkinCategories.id,
          name: fabricSkinCategories.name,
          slug: fabricSkinCategories.slug,
          merchandisingOrder: fabricSkinCategories.merchandisingOrder,
        })
        .from(fabricSkinCategories)
        .where(
          and(
            eq(fabricSkinCategories.parentId, parent.id),
            eq(fabricSkinCategories.hidden, false),
          ),
        )
        .orderBy(asc(fabricSkinCategories.merchandisingOrder));

      const childrenWithSkins = [];
      for (const child of children) {
        const skins = await db
          .select({
            id: fabricSkins.id,
            name: fabricSkins.name,
            fabricCode: fabricSkins.fabricCode,
            meshVariant: fabricSkins.meshVariant,
            priceMarkup: fabricSkins.priceMarkup,
          })
          .from(fabricSkins)
          .where(
            and(
              eq(fabricSkins.categoryId, child.id),
              eq(fabricSkins.hidden, false),
            ),
          );

        childrenWithSkins.push({ ...child, skins });
      }

      tree.push({ ...parent, children: childrenWithSkins });
    }

    return NextResponse.json(tree);
  } catch (err) {
    console.error("[fabric-skin-categories] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
