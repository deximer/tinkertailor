import { pgTable, uuid, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { components } from "./components";

export const componentCompatibility = pgTable(
  "component_compatibility",
  {
    componentAId: uuid("component_a_id")
      .notNull()
      .references(() => components.id),
    componentBId: uuid("component_b_id")
      .notNull()
      .references(() => components.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.componentAId, table.componentBId] }),
  ],
);
