import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, attributionLinks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireRole } from "@/lib/auth/guards";

const RESERVED_SLUGS = new Set([
  "api", "shop", "checkout", "orders", "auth", "admin",
  "designs", "design", "login", "signup", "settings",
  "webhooks", "health", "favicon",
]);

function generateSafeSlug(): string {
  let slug = nanoid(10);
  // Extremely unlikely for a 10-char nanoid to collide, but guard anyway
  while (RESERVED_SLUGS.has(slug)) {
    slug = nanoid(10);
  }
  return slug;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authError } = await requireRole("creator");
  if (authError) return authError;

  const { id: productId } = await params;

  try {
    // Verify the product exists and the caller is the creator
    const [product] = await db
      .select({ id: products.id, userId: products.userId })
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      return NextResponse.json({ error: "Design not found" }, { status: 404 });
    }

    if (product.userId !== user.id) {
      return NextResponse.json({ error: "Only the creator can share this design" }, { status: 403 });
    }

    // Idempotent: return existing link if one exists for this design+creator
    const existing = await db
      .select({ slug: attributionLinks.slug })
      .from(attributionLinks)
      .where(
        and(
          eq(attributionLinks.productId, productId),
          eq(attributionLinks.creatorId, user.id),
        ),
      );

    if (existing.length > 0) {
      return NextResponse.json({ url: `/shop/${existing[0].slug}` });
    }

    // Generate new attribution link with reserved path check
    const slug = generateSafeSlug();
    await db.insert(attributionLinks).values({
      productId,
      creatorId: user.id,
      slug,
    });

    return NextResponse.json({ url: `/shop/${slug}` }, { status: 201 });
  } catch (err) {
    console.error("[designs/[id]/share] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
