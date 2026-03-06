import { redirect, forbidden } from "next/navigation";
import { createClient, getUserRole } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const role = await getUserRole(supabase);
  if (role !== "admin") {
    forbidden();
  }

  return <>{children}</>;
}
