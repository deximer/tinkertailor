-- Auto-compatibility detection tables.
-- Stores analysis run metadata and the individual pair suggestions
-- produced by LLM-based compatibility inference.

CREATE TABLE IF NOT EXISTS "compatibility_analysis_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pair_type" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL,
  "confidence_threshold" numeric(3,2) NOT NULL,
  "only_unmatched" boolean NOT NULL DEFAULT true,
  "total_pairs" integer,
  "suggestions_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "compatibility_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "bodice_id" uuid NOT NULL,
  "partner_id" uuid NOT NULL,
  "confidence" numeric(5,4) NOT NULL,
  "sleeve_style" varchar(5),
  "already_exists" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "compatibility_suggestions_run_id_compatibility_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "compatibility_analysis_runs"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "compatibility_suggestions_bodice_id_components_id_fk" FOREIGN KEY ("bodice_id") REFERENCES "components"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "compatibility_suggestions_partner_id_components_id_fk" FOREIGN KEY ("partner_id") REFERENCES "components"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "idx_compatibility_suggestions_run_id" ON "compatibility_suggestions" ("run_id");
