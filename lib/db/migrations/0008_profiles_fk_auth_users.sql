-- 0008_profiles_fk_auth_users.sql
-- Adds missing FK constraint from profiles.id to auth.users.id with cascade delete.

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_id_auth_users_fk"
    FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
