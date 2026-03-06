"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    const next = searchParams.get("next") ?? "/";
    router.push(next);
    router.refresh();
  };

  return (
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
          autoComplete="current-password"
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
        {submitting ? "Signing in\u2026" : "Sign In"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
      <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-[#222] p-8">
        <p className="mb-6 text-center text-sm text-gray-400">
          Sign in to continue
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <div className="mt-4 flex flex-col gap-2 text-center text-sm text-gray-500">
          <Link
            href="/auth/reset-password"
            className="text-gray-400 hover:text-white"
          >
            Forgot password?
          </Link>
          <p>
            No account?{" "}
            <Link
              href="/signup"
              className="text-white underline hover:no-underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
