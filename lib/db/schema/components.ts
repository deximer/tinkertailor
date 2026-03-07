import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { componentTypes } from "./component-types";

export const components = pgTable("components", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  componentTypeId: uuid("component_type_id")
    .notNull()
    .references(() => componentTypes.id),
  // Human-readable legacy code from the asset library (e.g. "BOD-27", "SK-1", "SLV-3").
  // Used for import mapping and admin display. Null for components created from scratch.
  legacyCode: varchar("legacy_code", { length: 20 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
