import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { orders, attributionLinks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { calculateOrderTotal } from "@/lib/pricing/engine";
import Stripe from "stripe";

let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

export async function POST(request: Request) {
  // 1. Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      productId: string;
      shippingAddress?: Record<string, unknown>;
    };

    if (!body.productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // 2. Calculate pricing
    const pricing = await calculateOrderTotal({ productId: body.productId });

    // Check for attribution cookie
    let creatorId: string | null = null;
    const cookieStore = await cookies();
    const attributionSlug = cookieStore.get("attribution_slug")?.value;
    if (attributionSlug) {
      const [link] = await db
        .select({ creatorId: attributionLinks.creatorId })
        .from(attributionLinks)
        .where(eq(attributionLinks.slug, attributionSlug));
      if (link) {
        creatorId = link.creatorId;
      }
    }

    // 3. Create Stripe Payment Intent (amount in cents)
    const amountInCents = Math.round(parseFloat(pricing.total) * 100);
    const paymentIntent = await getStripeClient().paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: {
        productId: body.productId,
        userId: user.id,
      },
    });

    // 4. Insert pending order
    const [order] = await db
      .insert(orders)
      .values({
        userId: user.id,
        productId: body.productId,
        creatorId,
        stripePaymentIntentId: paymentIntent.id,
        status: "pending",
        subtotal: pricing.subtotal,
        shippingCost: pricing.shippingCost,
        total: pricing.total,
        shippingAddress: body.shippingAddress ?? null,
      })
      .returning({ id: orders.id });

    // 5. Return client secret and order ID
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
    });
  } catch (err) {
    console.error("[checkout/create-intent] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
