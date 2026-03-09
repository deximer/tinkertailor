import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { components } from "./components";
import { SleeveStyle } from "./component-compatibility";

// Analysis run pair types — which compatibility table to scan.
export const pairTypeEnum = ["bodice_skirt", "bodice_sleeve"] as const;
export type PairType = (typeof pairTypeEnum)[number];

// Analysis run statuses.
export const analysisStatusEnum = ["running", "completed", "failed"] as const;
export type AnalysisStatus = (typeof analysisStatusEnum)[number];

// Suggestion review statuses.
export const suggestionStatusEnum = [
  "pending",
  "accepted",
  "rejected",
] as const;
export type SuggestionStatus = (typeof suggestionStatusEnum)[number];

// Tracks each auto-compatibility detection run.
export const compatibilityAnalysisRuns = pgTable(
  "compatibility_analysis_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pairType: varchar("pair_type", { length: 20 })
      .notNull()
      .$type<PairType>(),
    status: varchar("status", { length: 20 })
      .notNull()
      .$type<AnalysisStatus>(),
    confidenceThreshold: numeric("confidence_threshold", {
      precision: 3,
      scale: 2,
    }).notNull(),
    onlyUnmatched: boolean("only_unmatched").notNull().default(true),
    totalPairs: integer("total_pairs"),
    suggestionsCount: integer("suggestions_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
);

// Individual compatibility suggestions produced by a run.
export const compatibilitySuggestions = pgTable(
  "compatibility_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => compatibilityAnalysisRuns.id, { onDelete: "cascade" }),
    bodiceId: uuid("bodice_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
    sleeveStyle: varchar("sleeve_style", { length: 5 }).$type<SleeveStyle>(),
    alreadyExists: boolean("already_exists").notNull().default(false),
    status: varchar("status", { length: 20 })
      .notNull()
      .default("pending")
      .$type<SuggestionStatus>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_compatibility_suggestions_run_id").on(table.runId)],
);
