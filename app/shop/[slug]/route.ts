import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attributionLinks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const [link] = await db
      .select({
        id: attributionLinks.id,
        productId: attributionLinks.productId,
      })
      .from(attributionLinks)
      .where(eq(attributionLinks.slug, slug));

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Increment click count (fire and forget)
    db.update(attributionLinks)
      .set({ clickCount: sql`${attributionLinks.clickCount} + 1` })
      .where(eq(attributionLinks.id, link.id))
      .then(() => {})
      .catch((err) => console.error("[shop/[slug]] Click count error:", err));

    // Redirect with attribution cookie
    const response = NextResponse.redirect(
      new URL(`/checkout?productId=${link.productId}`, _request.url),
    );

    response.cookies.set("attribution_slug", slug, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[shop/[slug]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
