"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded border border-gray-600 bg-[#2a2a2a] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-white"
    >
      Sign out
    </button>
  );
}
