"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteCodeForm() {
  const router = useRouter();
  const [role, setRole] = useState<"creator" | "shopper">("creator");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setGeneratedCode(null);
    setCopied(false);

    try {
      const body: { role: string; expiresAt?: string } = { role };
      if (expiresAt) {
        body.expiresAt = new Date(expiresAt).toISOString();
      }

      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedCode(data.code);
        setExpiresAt("");
        router.refresh();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to generate code");
      }
    } catch {
      setErrorMsg("Failed to generate code");
    }

    setSaving(false);
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-[#222] p-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "creator" | "shopper")}
            className="rounded border border-gray-600 bg-[#2a2a2a] px-3 py-1.5 text-sm text-white outline-none focus:border-gray-500"
          >
            <option value="creator">Creator</option>
            <option value="shopper">Shopper</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">
            Expires At (optional)
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded border border-gray-600 bg-[#2a2a2a] px-3 py-1.5 text-sm text-white outline-none focus:border-gray-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
        >
          {saving ? "Generating..." : "Generate Code"}
        </button>
      </form>

      {errorMsg && (
        <div className="mt-3 rounded border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          {errorMsg}
          <button
            onClick={() => setErrorMsg(null)}
            className="ml-3 text-red-400 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {generatedCode && (
        <div className="mt-3 flex items-center gap-3 rounded border border-green-800 bg-green-900/20 px-3 py-2">
          <span className="text-sm text-green-300">Generated:</span>
          <code className="rounded bg-[#333] px-2 py-0.5 font-mono text-sm text-white">
            {generatedCode}
          </code>
          <button
            onClick={handleCopy}
            className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-[#333] hover:text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
