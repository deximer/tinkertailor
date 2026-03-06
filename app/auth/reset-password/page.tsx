"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          window.location.origin + "/auth/callback?next=/auth/update-password",
      },
    );

    if (resetError) {
      setError(resetError.message);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
      <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-[#222] p-8">
        <p className="mb-6 text-center text-sm text-gray-400">
          Reset your password
        </p>

        {submitted ? (
          <div className="rounded border border-green-800 bg-green-900/30 px-3 py-2 text-sm text-green-300">
            Check your email for a password reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
                placeholder="you@example.com"
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
              {submitting ? "Sending\u2026" : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
