-- 0006_invite_codes.sql
-- Adds invite_codes table for invite-only signup flow.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invite_codes" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "role" "user_role" NOT NULL,
  "created_by" uuid REFERENCES "profiles"("id"),
  "used_by" uuid REFERENCES "profiles"("id"),
  "used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invite_codes_code_idx" ON "invite_codes" ("code");
