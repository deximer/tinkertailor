import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { partRoles } from "./part-roles";

export const garmentParts = pgTable("garment_parts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  partRoleId: uuid("part_role_id")
    .notNull()
    .references(() => partRoles.id),
  isAnchor: boolean("is_anchor").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
