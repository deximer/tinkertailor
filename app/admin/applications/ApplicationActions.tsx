"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApplicationActions({
  applicationId,
}: {
  applicationId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  async function handleApprove() {
    if (!confirm("Approve this application? The user will become a creator.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/approve`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to approve");
        return;
      }
      router.refresh();
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: rejectNote || undefined }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to reject");
        return;
      }
      setShowRejectForm(false);
      setRejectNote("");
      router.refresh();
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (showRejectForm) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Reason (optional)"
          className="rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none"
          disabled={loading}
        />
        <button
          onClick={handleReject}
          disabled={loading}
          className="rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
        <button
          onClick={() => {
            setShowRejectForm(false);
            setRejectNote("");
          }}
          disabled={loading}
          className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-[#333] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleApprove}
        disabled={loading}
        className="rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "..." : "Approve"}
      </button>
      <button
        onClick={() => setShowRejectForm(true)}
        disabled={loading}
        className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-800/50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
