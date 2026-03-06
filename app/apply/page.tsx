"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type ApplicationStatus = "pending" | "approved" | "rejected";

interface Application {
  id: string;
  status: ApplicationStatus;
  name: string;
  bio: string;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  portfolioUrl: string | null;
  createdAt: string;
}

type PageState =
  | { kind: "loading" }
  | { kind: "not-authenticated" }
  | { kind: "already-elevated"; role: string }
  | { kind: "existing-application"; application: Application }
  | { kind: "form" }
  | { kind: "submitted" };

export default function ApplyPage() {
  const [pageState, setPageState] = useState<PageState>({ kind: "loading" });
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPageState({ kind: "not-authenticated" });
        return;
      }

      const role = user.app_metadata?.app_role as string | undefined;
      if (role === "creator" || role === "admin") {
        setPageState({ kind: "already-elevated", role });
        return;
      }

      // Check for existing application
      try {
        const res = await fetch("/api/applications");
        if (res.ok) {
          const data = await res.json();
          if (data.application) {
            setPageState({
              kind: "existing-application",
              application: data.application,
            });
            return;
          }
        }
      } catch {
        // If check fails, show the form anyway
      }

      setPageState({ kind: "form" });
    }

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          instagramUrl: instagramUrl.trim() || undefined,
          tiktokUrl: tiktokUrl.trim() || undefined,
          portfolioUrl: portfolioUrl.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      setPageState({ kind: "submitted" });
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (pageState.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (pageState.kind === "not-authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-[#222] p-8 text-center">
          <p className="mb-4 text-gray-400">
            You need to sign in before applying to become a creator.
          </p>
          <Link
            href="/login?next=/apply"
            className="inline-block rounded bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-gray-200"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (pageState.kind === "already-elevated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-[#222] p-8 text-center">
          <p className="mb-4 text-gray-400">
            You already have the <span className="text-white font-medium">{pageState.role}</span> role.
          </p>
          <Link
            href="/"
            className="inline-block rounded bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-gray-200"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (pageState.kind === "existing-application") {
    const { application } = pageState;
    const statusColors: Record<ApplicationStatus, string> = {
      pending: "text-yellow-400 border-yellow-700 bg-yellow-900/30",
      approved: "text-green-400 border-green-700 bg-green-900/30",
      rejected: "text-red-400 border-red-700 bg-red-900/30",
    };
    const statusLabels: Record<ApplicationStatus, string> = {
      pending: "Pending Review",
      approved: "Approved",
      rejected: "Rejected",
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="w-full max-w-md rounded-lg border border-gray-700 bg-[#222] p-8">
          <h1 className="mb-4 text-lg font-semibold text-white">
            Your Creator Application
          </h1>
          <div
            className={`mb-4 inline-block rounded border px-3 py-1 text-sm font-medium ${statusColors[application.status]}`}
          >
            {statusLabels[application.status]}
          </div>
          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-500">
                Name
              </span>
              <p>{application.name}</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-500">
                Bio
              </span>
              <p>{application.bio}</p>
            </div>
            {application.instagramUrl && (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-500">
                  Instagram
                </span>
                <p>{application.instagramUrl}</p>
              </div>
            )}
            {application.tiktokUrl && (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-500">
                  TikTok
                </span>
                <p>{application.tiktokUrl}</p>
              </div>
            )}
            {application.portfolioUrl && (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-500">
                  Portfolio
                </span>
                <p>{application.portfolioUrl}</p>
              </div>
            )}
          </div>
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-gray-400 hover:text-white"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (pageState.kind === "submitted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-[#222] p-8 text-center">
          <div className="mb-4 text-3xl">&#10003;</div>
          <h1 className="mb-2 text-lg font-semibold text-white">
            Application Submitted
          </h1>
          <p className="mb-6 text-sm text-gray-400">
            Thank you for applying! We&apos;ll review your application and get
            back to you soon.
          </p>
          <Link
            href="/"
            className="inline-block rounded bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-gray-200"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // kind === "form"
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-[#222] p-8">
        <h1 className="mb-2 text-lg font-semibold text-white">
          Apply to Become a Creator
        </h1>
        <p className="mb-6 text-sm text-gray-400">
          Tell us about yourself and why you&apos;d like to create on Tinker
          Tailor.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="Your name"
            />
          </div>

          <div>
            <label
              htmlFor="bio"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              Bio <span className="text-red-400">*</span>
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              required
              rows={4}
              className="w-full resize-y rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="Tell us about your design style and experience"
            />
          </div>

          <div>
            <label
              htmlFor="instagram"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              Instagram Handle
            </label>
            <input
              id="instagram"
              type="text"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="@yourhandle"
            />
          </div>

          <div>
            <label
              htmlFor="tiktok"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              TikTok Handle
            </label>
            <input
              id="tiktok"
              type="text"
              value={tiktokUrl}
              onChange={(e) => setTiktokUrl(e.target.value)}
              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="@yourhandle"
            />
          </div>

          <div>
            <label
              htmlFor="portfolio"
              className="mb-1 block text-xs uppercase tracking-wider text-gray-400"
            >
              Portfolio URL
            </label>
            <input
              id="portfolio"
              type="text"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none"
              placeholder="https://your-portfolio.com"
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
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-4 inline-block text-sm text-gray-400 hover:text-white"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
