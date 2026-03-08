"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
      <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-[#222] p-8">
        <p className="mb-6 text-center text-sm text-gray-400">
          Set a new password
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {submitting ? "Updating\u2026" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
