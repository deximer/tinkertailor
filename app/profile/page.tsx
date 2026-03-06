"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface ProfileData {
  id: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-900/50 text-purple-300 border-purple-700",
  creator: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  shopper: "bg-blue-900/50 text-blue-300 border-blue-700",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<File | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) {
          throw new Error("Failed to load profile");
        }
        const data: ProfileData = await res.json();
        setProfile(data);
        setDisplayName(data.displayName ?? "");
        setAvatarPreview(data.avatarUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    avatarFileRef.current = file;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let res: Response;

      if (avatarFileRef.current) {
        const formData = new FormData();
        formData.append("displayName", displayName);
        formData.append("avatar", avatarFileRef.current);
        res = await fetch("/api/profile", {
          method: "PUT",
          body: formData,
        });
      } else {
        res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update profile");
      }

      const updated: ProfileData = await res.json();
      setProfile(updated);
      setDisplayName(updated.displayName ?? "");
      setAvatarPreview(updated.avatarUrl);
      avatarFileRef.current = null;
      setSuccess("Profile updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <p className="text-gray-400">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <div className="text-center">
          <p className="mb-4 text-red-400">{error ?? "Profile not found"}</p>
          <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const roleColors =
    ROLE_COLORS[profile.role] ?? "bg-gray-800 text-gray-300 border-gray-600";

  return (
    <div className="min-h-screen bg-[#111] px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Your Profile</h1>
          <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">
            Back to home
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-800 bg-[#1a1a1a] p-6"
        >
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-20 w-20 overflow-hidden rounded-full border-2 border-gray-600 transition-colors hover:border-gray-400"
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#2a2a2a] text-2xl font-bold text-gray-500">
                  {displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-xs text-white">Change</span>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-xs text-gray-500">Click to change avatar</p>
          </div>

          {/* Display Name */}
          <div>
            <label
              htmlFor="displayName"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none"
              placeholder="Your display name"
            />
          </div>

          {/* Role Badge */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Role
            </label>
            <span
              className={`inline-block rounded-full border px-3 py-1 text-xs font-medium capitalize ${roleColors}`}
            >
              {profile.role}
            </span>
            {profile.role === "shopper" && (
              <Link
                href="/apply"
                className="ml-3 text-xs text-emerald-400 hover:text-emerald-300"
              >
                Apply to become a creator
              </Link>
            )}
            {profile.role === "creator" && profile.handle && (
              <Link
                href={`/creator/${profile.handle}`}
                className="ml-3 text-xs text-emerald-400 hover:text-emerald-300"
              >
                View your public profile
              </Link>
            )}
          </div>

          {/* Feedback */}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
