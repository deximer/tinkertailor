import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const role = user.app_metadata?.role as string | undefined;
  if (role && role !== "admin") {
    redirect("/login?next=/admin");
  }

  return <>{children}</>;
}
