"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

interface PricingBreakdown {
  subtotal: string;
  shippingCost: string;
  total: string;
}

interface DesignComponent {
  id: string;
  name: string;
  typeName: string;
  fabricSkinName: string | null;
}

interface DesignDetails {
  id: string;
  name: string;
  components: DesignComponent[];
}

interface ShippingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const INITIAL_ADDRESS: ShippingAddress = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

function CheckoutForm({
  productId,
  pricing,
  design,
}: {
  productId: string;
  pricing: PricingBreakdown;
  design: DesignDetails;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [address, setAddress] = useState<ShippingAddress>(INITIAL_ADDRESS);

  const updateAddress = (field: keyof ShippingAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    if (!address.name || !address.line1 || !address.city || !address.state || !address.postalCode) {
      setError("Please fill in all required shipping fields.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent on the server
      const res = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          shippingAddress: address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create payment intent");
      }

      const { clientSecret, orderId } = await res.json();

      // Confirm payment with Stripe
      const { error: stripeError } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: address.name,
              address: {
                line1: address.line1,
                line2: address.line2 || undefined,
                city: address.city,
                state: address.state,
                postal_code: address.postalCode,
                country: address.country,
              },
            },
          },
        },
      );

      if (stripeError) {
        setError(stripeError.message ?? "Payment failed");
        setProcessing(false);
        return;
      }

      router.push(`/orders/${orderId}/confirmation`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Order Summary */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Order Summary
        </h2>
        <div className="rounded-lg border border-gray-700 bg-[#1a1a1a] p-4">
          <h3 className="mb-2 font-medium text-white">{design.name}</h3>
          <ul className="mb-4 space-y-1 text-sm text-gray-400">
            {design.components.map((c) => (
              <li key={c.id}>
                {c.typeName}: {c.name}
                {c.fabricSkinName && (
                  <span className="text-gray-500"> in {c.fabricSkinName}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-gray-700 pt-3 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Subtotal</span>
              <span>${pricing.subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Shipping</span>
              <span>${pricing.shippingCost}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-2 text-base font-semibold text-white">
              <span>Total</span>
              <span>${pricing.total}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Shipping Address */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Shipping Address
        </h2>
        <div className="grid gap-3">
          <input
            type="text"
            placeholder="Full name *"
            value={address.name}
            onChange={(e) => updateAddress("name", e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
            required
          />
          <input
            type="text"
            placeholder="Address line 1 *"
            value={address.line1}
            onChange={(e) => updateAddress("line1", e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
            required
          />
          <input
            type="text"
            placeholder="Address line 2"
            value={address.line2}
            onChange={(e) => updateAddress("line2", e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="City *"
              value={address.city}
              onChange={(e) => updateAddress("city", e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
              required
            />
            <input
              type="text"
              placeholder="State *"
              value={address.state}
              onChange={(e) => updateAddress("state", e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="ZIP code *"
              value={address.postalCode}
              onChange={(e) => updateAddress("postalCode", e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
              required
            />
            <input
              type="text"
              placeholder="Country"
              value={address.country}
              onChange={(e) => updateAddress("country", e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Card Input */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Payment</h2>
        <div className="rounded-md border border-gray-700 bg-[#1a1a1a] p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "14px",
                  color: "#fff",
                  "::placeholder": { color: "#6b7280" },
                },
                invalid: { color: "#ef4444" },
              },
            }}
          />
        </div>
      </section>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
      >
        {processing ? "Processing..." : `Pay $${pricing.total}`}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [design, setDesign] = useState<DesignDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setError("No product selected");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [priceRes, designRes] = await Promise.all([
          fetch(`/api/checkout/price?productId=${productId}`),
          fetch(`/api/designs/${productId}`),
        ]);

        if (!priceRes.ok || !designRes.ok) {
          throw new Error("Failed to load checkout details");
        }

        const [priceData, designData] = await Promise.all([
          priceRes.json(),
          designRes.json(),
        ]);

        setPricing(priceData);
        setDesign(designData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [productId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <p className="text-gray-400">Loading checkout...</p>
      </div>
    );
  }

  if (error || !pricing || !design || !productId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <p className="text-red-400">{error || "Something went wrong"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-8 text-2xl font-bold text-white">Checkout</h1>
        <Elements stripe={stripePromise}>
          <CheckoutForm
            productId={productId}
            pricing={pricing}
            design={design}
          />
        </Elements>
      </div>
    </div>
  );
}
