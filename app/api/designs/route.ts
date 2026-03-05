import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { products, productComponents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// POST /api/designs — save current design session
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      silhouetteTemplateId?: string;
      selectedComponentIds: string[];
      selectedFabricSkinId?: string;
    };

    if (!body.selectedComponentIds || body.selectedComponentIds.length === 0) {
      return NextResponse.json(
        { error: "At least one component is required" },
        { status: 400 },
      );
    }

    const designName =
      body.name || `My Design ${new Date().toLocaleDateString()}`;

    // Create the product row
    const [product] = await db
      .insert(products)
      .values({
        userId: user.id,
        name: designName,
        status: "draft",
        silhouetteTemplateId: body.silhouetteTemplateId ?? null,
      })
      .returning({ id: products.id });

    // Create product component rows
    const componentRows = body.selectedComponentIds.map((compId, idx) => ({
      productId: product.id,
      componentId: compId,
      fabricSkinId: body.selectedFabricSkinId ?? null,
      displayOrder: idx,
    }));

    await db.insert(productComponents).values(componentRows);

    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (err) {
    console.error("[designs POST] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET /api/designs — list user's saved designs
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const designs = await db
      .select({
        id: products.id,
        name: products.name,
        status: products.status,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(eq(products.userId, user.id))
      .orderBy(desc(products.updatedAt));

    // Filter out archived (we use status check, but also allow drafts and published)
    const active = designs.filter((d) => d.status !== "archived");

    return NextResponse.json(active);
  } catch (err) {
    console.error("[designs GET] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
