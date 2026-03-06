"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface OrderDetail {
  id: string;
  status: string;
  subtotal: string;
  shippingCost: string;
  total: string;
  shippingAddress: ShippingAddress | null;
  createdAt: string;
  updatedAt: string;
  productName: string | null;
  shipmentStatus: string | null;
  trackingNumber: string | null;
  carrier: string | null;
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
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orders/${id}`);
        if (res.status === 404) {
          setError("Order not found");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load order");
        }
        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <p className="text-gray-400">Loading order...</p>
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
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const addr = order.shippingAddress;

  return (
    <div className="min-h-screen bg-[#111] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link
          href="/orders"
          className="mb-6 inline-block text-sm text-emerald-400 hover:text-emerald-300"
        >
          &larr; Back to orders
        </Link>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {order.productName ?? "Untitled Design"}
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Order placed {formatDate(order.createdAt)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Pricing Breakdown */}
        <section className="mb-6 rounded-lg border border-gray-800 bg-[#1a1a1a] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Pricing
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Subtotal</span>
              <span>${order.subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Shipping</span>
              <span>${order.shippingCost}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-2 text-base font-semibold text-white">
              <span>Total</span>
              <span>${order.total}</span>
            </div>
          </div>
        </section>

        {/* Shipping Address */}
        {addr && (
          <section className="mb-6 rounded-lg border border-gray-800 bg-[#1a1a1a] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Shipping Address
            </h2>
            <div className="space-y-1 text-sm text-gray-300">
              {addr.name && <p className="font-medium text-white">{addr.name}</p>}
              {addr.line1 && <p>{addr.line1}</p>}
              {addr.line2 && <p>{addr.line2}</p>}
              {(addr.city || addr.state || addr.postalCode) && (
                <p>
                  {[addr.city, addr.state].filter(Boolean).join(", ")}
                  {addr.postalCode && ` ${addr.postalCode}`}
                </p>
              )}
              {addr.country && <p>{addr.country}</p>}
            </div>
          </section>
        )}

        {/* Shipment Tracking */}
        {order.shipmentStatus && (
          <section className="mb-6 rounded-lg border border-gray-800 bg-[#1a1a1a] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Shipment
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Status</span>
                <span className="font-medium capitalize text-white">
                  {order.shipmentStatus.replace(/_/g, " ")}
                </span>
              </div>
              {order.carrier && (
                <div className="flex justify-between text-gray-300">
                  <span>Carrier</span>
                  <span className="text-white">{order.carrier}</span>
                </div>
              )}
              {order.trackingNumber && (
                <div className="flex justify-between text-gray-300">
                  <span>Tracking</span>
                  <span className="font-mono text-xs text-emerald-400">
                    {order.trackingNumber}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Dates */}
        <section className="rounded-lg border border-gray-800 bg-[#1a1a1a] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Details
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Order ID</span>
              <span className="font-mono text-xs text-gray-500">
                {order.id.slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Created</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Last updated</span>
              <span>{formatDate(order.updatedAt)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
