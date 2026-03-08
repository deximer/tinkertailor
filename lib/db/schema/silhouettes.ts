import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { components } from "./components";
import { fabrics } from "./fabrics";

export const silhouetteTemplates = pgTable("silhouette_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  patternId: varchar("pattern_id", { length: 50 }).notNull().unique(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  basePrice: numeric("base_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  description: varchar("description", { length: 2000 }),
  isComposable: boolean("is_composable").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const silhouetteComponents = pgTable(
  "silhouette_components",
  {
    silhouetteId: uuid("silhouette_id")
      .notNull()
      .references(() => silhouetteTemplates.id),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id),
    defaultFabricId: uuid("default_fabric_id").references(
      () => fabrics.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.silhouetteId, table.componentId] }),
  ],
);
