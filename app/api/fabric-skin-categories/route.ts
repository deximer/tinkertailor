import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { fabricSkinCategories, fabricSkins } from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getCompatibleFabrics } from "@/lib/compatibility";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const compatibleWith = searchParams.get("compatible_with");

  // If compatible_with is provided, delegate to the compatibility engine
  if (compatibleWith) {
    const selectedIds = compatibleWith.split(",").filter(Boolean);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getCompatibleFabrics(db as any, selectedIds);
    return NextResponse.json(result);
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
          modelType: fabricSkins.modelType,
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
}
