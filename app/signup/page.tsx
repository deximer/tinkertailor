"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, inviteCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      // Sign in the newly created user
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Account created but sign-in failed. Please log in.");
        setSubmitting(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
      <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-[#222] p-8">
        <p className="mb-6 text-center text-sm text-gray-400">
          Create your account
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="invite-code"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              Invite Code
            </label>
            <input
              id="invite-code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="Enter your invite code"
            />
          </div>

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

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="Min. 8 characters"
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
            {submitting ? "Creating account\u2026" : "Sign Up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-white underline hover:no-underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
