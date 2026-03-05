"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface OrderSummary {
  id: string;
  status: string;
  total: string;
  createdAt: string;
  productName: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  paid: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  failed: "bg-red-900/50 text-red-300 border-red-700",
  refunded: "bg-gray-800 text-gray-300 border-gray-600",
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? "bg-gray-800 text-gray-300 border-gray-600";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${colors}`}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchOrders = useCallback(async (cursor?: string) => {
    const url = cursor ? `/api/orders?cursor=${encodeURIComponent(cursor)}` : "/api/orders";
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Failed to load orders");
    }
    return res.json() as Promise<{ items: OrderSummary[]; nextCursor: string | null }>;
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchOrders();
        setOrders(data.items);
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fetchOrders]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchOrders(nextCursor);
      setOrders((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more orders");
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <p className="text-gray-400">Loading orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <div className="text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <Link
            href="/design"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            Back to designs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Your Orders</h1>
          <Link
            href="/design"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            Continue designing
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-[#1a1a1a] p-8 text-center">
            <p className="mb-4 text-gray-400">No orders yet.</p>
            <Link
              href="/design"
              className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Start designing
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block rounded-lg border border-gray-800 bg-[#1a1a1a] p-4 transition-colors hover:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-white">
                      {order.productName ?? "Untitled Design"}
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">${order.total}</p>
                    <div className="mt-1">
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {nextCursor && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-4 w-full rounded-md border border-gray-700 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
