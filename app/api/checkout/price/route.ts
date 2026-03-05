import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { calculateOrderTotal } from "@/lib/pricing/engine";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return NextResponse.json(
      { error: "productId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    // Verify the product exists and the user has access
    const productRows = await db
      .select({
        id: products.id,
        userId: products.userId,
        status: products.status,
      })
      .from(products)
      .where(eq(products.id, productId));

    if (productRows.length === 0) {
      return NextResponse.json({ error: "Design not found" }, { status: 404 });
    }

    const product = productRows[0];

    // User must own the design or it must be published
    if (product.userId !== user.id && product.status !== "published") {
      return NextResponse.json({ error: "Design not found" }, { status: 404 });
    }

    const pricing = await calculateOrderTotal({ productId });

    return NextResponse.json(pricing);
  } catch (err) {
    console.error("[checkout/price] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
