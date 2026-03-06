import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/db/schema/profiles";

type AuthSuccess = { user: User; role: UserRole | null; error: null };
type AuthFailure = { user: null; role: null; error: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

/**
 * Require the caller to be authenticated. Returns the user and their role
 * (from app_metadata.app_role), or a 401 JSON response.
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      role: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role = (user.app_metadata?.app_role as UserRole) ?? null;
  return { user, role, error: null };
}

/**
 * Require the caller to have a specific role. Returns 401 if not
 * authenticated, 403 if authenticated but wrong role.
 */
export async function requireRole(
  role: UserRole,
): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.error) return result;

  if (result.role !== role) {
    return {
      user: null,
      role: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return result;
}

/**
 * Require the caller to have one of the specified roles.
 */
export async function requireAnyRole(
  roles: UserRole[],
): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.error) return result;

  if (!result.role || !roles.includes(result.role)) {
    return {
      user: null,
      role: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return result;
}

/**
 * Convenience alias: require admin role.
 */
export async function requireAdmin(): Promise<AuthResult> {
  return requireRole("admin");
}
