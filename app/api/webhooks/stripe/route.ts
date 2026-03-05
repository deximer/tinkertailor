import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";
import { sendOrderConfirmationEmail } from "@/lib/email/order-confirmation";

let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[webhooks/stripe] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      const [updatedOrder] = await db
        .update(orders)
        .set({
          status: "paid",
          stripeChargeId: paymentIntent.latest_charge as string | null,
          updatedAt: new Date(),
        })
        .where(eq(orders.stripePaymentIntentId, paymentIntent.id))
        .returning({
          id: orders.id,
          userId: orders.userId,
          productId: orders.productId,
          total: orders.total,
        });

      if (updatedOrder) {
        // Send confirmation email (best-effort, don't fail the webhook)
        try {
          const [product] = await db
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, updatedOrder.productId));

          const email = paymentIntent.receipt_email
            ?? (paymentIntent.metadata?.email as string | undefined);

          if (email) {
            await sendOrderConfirmationEmail({
              to: email,
              orderId: updatedOrder.id,
              designName: product?.name ?? "Custom Design",
              total: updatedOrder.total,
            });
          }
        } catch (emailErr) {
          console.error("[webhooks/stripe] Email send error:", emailErr);
        }
      }
    } catch (err) {
      console.error("[webhooks/stripe] DB update error:", err);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
