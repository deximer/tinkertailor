import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productComponents } from "@/lib/db/schema";
import { eq, desc, ne, count, and } from "drizzle-orm";
import { requireRole, requireAuth } from "@/lib/auth/guards";

// POST /api/designs — save current design session (creator only)
export async function POST(request: Request) {
  const { user, error: authError } = await requireRole("creator");
  if (authError) return authError;

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

// GET /api/designs — list user's saved designs (paginated, any authenticated user)
export async function GET(request: Request) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
      100,
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") ?? "0", 10) || 0,
      0,
    );

    const whereClause = and(
      eq(products.userId, user.id),
      ne(products.status, "archived"),
    );

    const [designs, [{ total }]] = await Promise.all([
      db
        .select({
          id: products.id,
          name: products.name,
          status: products.status,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .where(whereClause)
        .orderBy(desc(products.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(products)
        .where(whereClause),
    ]);

    return NextResponse.json({ designs, totalCount: total, limit, offset });
  } catch (err) {
    console.error("[designs GET] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
