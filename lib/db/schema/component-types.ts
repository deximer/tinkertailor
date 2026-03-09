import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { garmentParts } from "./garment-parts";

export const componentTypes = pgTable("component_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  garmentPartId: uuid("garment_part_id").references(() => garmentParts.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
