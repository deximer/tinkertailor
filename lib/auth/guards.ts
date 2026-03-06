import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type AuthResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse };

/**
 * Require the caller to be an authenticated admin user.
 * Checks app_metadata.role when the role system is active;
 * falls back to allowing any authenticated user if no role is set
 * (pre-User-Onboarding state).
 */
export async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role = user.app_metadata?.role as string | undefined;
  if (role && role !== "admin") {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, error: null };
}
