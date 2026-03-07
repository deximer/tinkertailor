"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { href: "/admin/component-types", label: "Component Types & Categories" },
  { href: "/admin/components", label: "Components" },
  { href: "/admin/component-meshes", label: "Component Meshes" },
  { href: "/admin/compatibility", label: "Compatibility Graph" },
  { href: "/admin/fabrics", label: "Fabric Catalog" },
  { href: "/admin/component-fabric-rules", label: "Component Fabric Rules" },
  { href: "/admin/tags", label: "Tag Dimensions & Values" },
  { href: "/admin/silhouettes", label: "Silhouettes" },
];

export default function AdminPage() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Tinker Tailor — Admin
          </h1>
          <button
            onClick={handleLogout}
            className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
          >
            Sign Out
          </button>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            Pattern Library
          </h2>
          <nav className="grid grid-cols-2 gap-2">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded border border-gray-700 px-4 py-3 text-sm text-gray-200 hover:bg-[#2a2a2a] hover:border-gray-500 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            User Management
          </h2>
          <nav className="grid grid-cols-2 gap-2">
            <Link
              href="/admin/invite-codes"
              className="rounded border border-gray-700 px-4 py-3 text-sm text-gray-200 hover:bg-[#2a2a2a] hover:border-gray-500 transition-colors"
            >
              Invite Codes
            </Link>
            <Link
              href="/admin/applications"
              className="rounded border border-gray-700 px-4 py-3 text-sm text-gray-200 hover:bg-[#2a2a2a] hover:border-gray-500 transition-colors"
            >
              Applications
            </Link>
          </nav>
        </section>

      </div>
    </div>
  );
}
