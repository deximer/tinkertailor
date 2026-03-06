-- 0007_creator_applications.sql
-- Adds handle column to profiles and creator_applications table.

--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "handle" text UNIQUE;

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creator_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "profiles"("id"),
  "status" "application_status" DEFAULT 'pending' NOT NULL,
  "name" text NOT NULL,
  "bio" text NOT NULL,
  "instagram_url" text,
  "tiktok_url" text,
  "portfolio_url" text,
  "admin_note" text,
  "reviewed_by" uuid REFERENCES "profiles"("id"),
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_creator_applications_status"
  ON "creator_applications" ("status");

--> statement-breakpoint
ALTER TABLE "creator_applications" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- Users can read their own application
DO $$ BEGIN
  CREATE POLICY "creator_applications_select_own" ON "creator_applications"
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
-- Admins can read all applications
DO $$ BEGIN
  CREATE POLICY "creator_applications_select_admin" ON "creator_applications"
    FOR SELECT
    TO authenticated
    USING (
      (auth.jwt() -> 'app_metadata' ->> 'app_role') = 'admin'
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
-- Users can insert their own application
DO $$ BEGIN
  CREATE POLICY "creator_applications_insert_own" ON "creator_applications"
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
-- Admins can update any application (approve/reject)
DO $$ BEGIN
  CREATE POLICY "creator_applications_update_admin" ON "creator_applications"
    FOR UPDATE
    TO authenticated
    USING (
      (auth.jwt() -> 'app_metadata' ->> 'app_role') = 'admin'
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
