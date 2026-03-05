"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface OrderConfirmation {
  id: string;
  status: string;
  total: string;
  createdAt: string;
  productName: string | null;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30; // 60s max

export default function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollCount = useRef(0);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    if (res.status === 404) {
      throw new Error("Order not found");
    }
    if (!res.ok) {
      throw new Error("Failed to load order");
    }
    return (await res.json()) as OrderConfirmation;
  }, [id]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchOrder();
        if (cancelled) return;
        setOrder(data);
        setLoading(false);

        // Keep polling while pending until webhook confirms payment
        if (data.status === "pending" && pollCount.current < MAX_POLLS) {
          pollCount.current++;
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load order");
        setLoading(false);
      }
    }
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <p className="text-gray-400">Loading confirmation...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <div className="text-center">
          <p className="mb-4 text-red-400">{error || "Order not found"}</p>
          <Link
            href="/orders"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            View your orders
          </Link>
        </div>
      </div>
    );
  }

  const isPending = order.status === "pending";

  return (
    <div className="min-h-screen bg-[#111] px-4 py-8">
      <div className="mx-auto max-w-lg text-center">
        <div className="mb-8">
          {isPending ? (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-900/50 text-3xl animate-pulse">
                <span role="img" aria-label="processing">&#9203;</span>
              </div>
              <h1 className="text-3xl font-bold text-white">
                Finalizing your order...
              </h1>
              <p className="mt-2 text-gray-400">
                Your payment is being processed. This usually takes a few
                seconds.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900/50 text-3xl">
                <span role="img" aria-label="checkmark">&#10003;</span>
              </div>
              <h1 className="text-3xl font-bold text-white">Thank you!</h1>
              <p className="mt-2 text-gray-400">
                Your order has been confirmed.
              </p>
            </>
          )}
        </div>

        <div className="mb-8 rounded-lg border border-gray-800 bg-[#1a1a1a] p-6 text-left">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Order Summary
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Design</span>
              <span className="font-medium text-white">
                {order.productName ?? "Untitled Design"}
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Order ID</span>
              <span className="font-mono text-xs text-gray-500">
                {order.id.slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-3 text-base font-semibold text-white">
              <span>Total</span>
              <span>${order.total}</span>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-gray-800 bg-[#1a1a1a] p-4">
          <p className="text-sm text-gray-300">
            Estimated delivery:{" "}
            <span className="font-medium text-white">2-3 weeks</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Your custom garment will be handcrafted and shipped to you.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/orders"
            className="rounded-md border border-gray-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:border-gray-600"
          >
            View your orders
          </Link>
          <Link
            href="/design"
            className="rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Continue designing
          </Link>
        </div>
      </div>
    </div>
  );
}
