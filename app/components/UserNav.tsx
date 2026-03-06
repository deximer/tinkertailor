import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

export default async function UserNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const role = await getUserRole(supabase);

  const linkClass =
    "rounded border border-gray-600 bg-[#2a2a2a] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-white";

  return (
    <nav className="fixed top-4 right-4 z-20 flex items-center gap-2">
      {role === "admin" && (
        <Link href="/admin" className={linkClass}>
          Admin
        </Link>
      )}
      {(role === "creator" || role === "admin") && (
        <Link href="/design" className={linkClass}>
          Design Studio
        </Link>
      )}
      <Link href="/profile" className={linkClass}>
        Profile
      </Link>
      <Link href="/orders" className={linkClass}>
        Orders
      </Link>
      <LogoutButton />
    </nav>
  );
}
