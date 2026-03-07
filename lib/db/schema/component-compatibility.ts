import { pgTable, uuid, varchar, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { components } from "./components";

// Valid bodice + skirt pairings.
// Source: nogit/assets/xls/Original TT Component Matches.xlsx (Skirts sheet)
// + manual curation for components added after the spreadsheet.
export const bodiceSkirtCompatibility = pgTable(
  "bodice_skirt_compatibility",
  {
    bodiceId: uuid("bodice_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    skirtId: uuid("skirt_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bodiceId, table.skirtId] }),
  ],
);

// Sleeve style codes from the legacy compatibility spreadsheet.
// ST = set-in (standard), DS = drop-shoulder, OS = off-shoulder.
export const sleeveStyleEnum = ["ST", "DS", "OS"] as const;
export type SleeveStyle = (typeof sleeveStyleEnum)[number];

// Valid bodice + sleeve pairings.
// sleeveStyleCode captures the attachment geometry requirement.
// Source: nogit/assets/xls/Original TT Component Matches.xlsx (Sleeves sheet)
export const bodiceSleeveCompatibility = pgTable(
  "bodice_sleeve_compatibility",
  {
    bodiceId: uuid("bodice_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    sleeveId: uuid("sleeve_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    // The sleeve attachment style required by this pairing.
    sleeveStyleCode: varchar("sleeve_style_code", { length: 5 }).$type<SleeveStyle>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bodiceId, table.sleeveId] }),
  ],
);
