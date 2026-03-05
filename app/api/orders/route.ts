import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { orders, products } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: orders.id,
        status: orders.status,
        subtotal: orders.subtotal,
        shippingCost: orders.shippingCost,
        total: orders.total,
        createdAt: orders.createdAt,
        productName: products.name,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/orders] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
