import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/db/schema/profiles";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can fail in Server Components where cookies are read-only.
            // This is expected — the middleware refreshes sessions instead.
          }
        },
      },
    },
  );
}

/**
 * Read the user's role from the JWT app_metadata claim.
 * The `custom_access_token_hook` DB function stamps `app_role` into the JWT
 * so this requires no additional DB query.
 *
 * Setup: Register `public.custom_access_token_hook` as a Custom Access Token
 * Hook in the Supabase Auth dashboard (Authentication → Hooks).
 */
export async function getUserRole(
  supabase: SupabaseClient,
): Promise<UserRole | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const role = session.user.app_metadata?.app_role as UserRole | undefined;
  return role ?? null;
}
