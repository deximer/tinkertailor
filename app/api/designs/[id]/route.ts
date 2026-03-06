import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  products,
  productComponents,
  components,
  componentTypes,
  fabricSkins,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/designs/[id] — get full design with components
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Get the product, scoped to the authenticated user
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.userId, user.id)))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get components with their details
    const comps = await db
      .select({
        id: productComponents.id,
        componentId: productComponents.componentId,
        fabricSkinId: productComponents.fabricSkinId,
        displayOrder: productComponents.displayOrder,
        componentName: components.name,
        componentCode: components.code,
        componentModelPath: components.modelPath,
        componentTypeName: componentTypes.name,
        componentTypeSlug: componentTypes.slug,
        componentStage: componentTypes.stage,
        fabricSkinName: fabricSkins.name,
        fabricCode: fabricSkins.fabricCode,
        fabricPriceMarkup: fabricSkins.priceMarkup,
      })
      .from(productComponents)
      .innerJoin(components, eq(productComponents.componentId, components.id))
      .innerJoin(
        componentTypes,
        eq(components.componentTypeId, componentTypes.id),
      )
      .leftJoin(fabricSkins, eq(productComponents.fabricSkinId, fabricSkins.id))
      .where(eq(productComponents.productId, id))
      .orderBy(productComponents.displayOrder);

    return NextResponse.json({
      id: product.id,
      name: product.name,
      status: product.status,
      silhouetteTemplateId: product.silhouetteTemplateId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      components: comps.map((c) => ({
        id: c.componentId,
        name: c.componentName,
        code: c.componentCode,
        modelPath: c.componentModelPath,
        typeName: c.componentTypeName,
        typeSlug: c.componentTypeSlug,
        stage: c.componentStage,
        fabricSkinId: c.fabricSkinId,
        fabricSkinName: c.fabricSkinName,
        fabricCode: c.fabricCode,
        fabricPriceMarkup: c.fabricPriceMarkup,
      })),
    });
  } catch (err) {
    console.error("[designs/[id] GET] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/designs/[id] — soft delete (set status to archived)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, id), eq(products.userId, user.id)))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Soft delete by setting status to "archived"
    // The status column is varchar so we can set any value
    await db
      .update(products)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[designs/[id] DELETE] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
