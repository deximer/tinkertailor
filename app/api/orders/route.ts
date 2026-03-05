import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { orders, products } from "@/lib/db/schema";
import { eq, desc, and, lt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

const PAGE_SIZE = 20;

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
    const cursor = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(
      Math.max(parseInt(limitParam ?? "", 10) || PAGE_SIZE, 1),
      100,
    );

    const conditions: SQL[] = [eq(orders.userId, user.id)];
    if (cursor) {
      conditions.push(lt(orders.createdAt, new Date(cursor)));
    }

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
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? items[items.length - 1].createdAt.toISOString()
      : null;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    console.error("[api/orders] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
