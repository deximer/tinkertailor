-- 0005_profiles_and_roles.sql
-- Adds user_role enum, profiles table, RLS policies, and JWT custom claim hook.

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('admin', 'creator', 'shopper');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "role" "user_role" DEFAULT 'shopper' NOT NULL,
  "display_name" text,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- Enable RLS on profiles
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- Users can read their own profile
DO $$ BEGIN
  CREATE POLICY "profiles_select_own" ON "profiles"
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
-- Users can update their own profile
DO $$ BEGIN
  CREATE POLICY "profiles_update_own" ON "profiles"
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
-- Admins can read all profiles
DO $$ BEGIN
  CREATE POLICY "profiles_select_admin" ON "profiles"
    FOR SELECT
    TO authenticated
    USING (
      (auth.jwt() -> 'app_metadata' ->> 'app_role') = 'admin'
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
-- Supabase custom access token hook: stamps app_role into JWT app_metadata.
-- Must be registered in Supabase Auth dashboard under "Custom Access Token Hook".
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role public.user_role;
BEGIN
  -- Read the user's role from profiles
  SELECT role INTO user_role
    FROM public.profiles
    WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    -- Merge app_role into existing app_metadata
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object('app_role', user_role)
    );
  ELSE
    -- No profile row yet — set app_role to null so downstream code can detect it
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) || '{"app_role": null}'::jsonb
    );
  END IF;

  -- Update the claims in the event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

--> statement-breakpoint
-- Grant execute to supabase_auth_admin so the hook can be invoked
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

--> statement-breakpoint
-- Revoke execute from public roles — only auth system should call this
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

--> statement-breakpoint
-- Grant supabase_auth_admin read access to profiles so the hook can query it
GRANT SELECT ON public.profiles TO supabase_auth_admin;
