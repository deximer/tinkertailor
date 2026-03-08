import { type AnyPgColumn } from "drizzle-orm/pg-core";
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";
import { components } from "./components";

export const fabricCategories = pgTable("fabric_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  parentId: uuid("parent_id").references((): AnyPgColumn => fabricCategories.id),
  merchandisingOrder: integer("merchandising_order").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const fabrics = pgTable("fabrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  fabricCode: varchar("fabric_code", { length: 50 }).notNull().unique(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => fabricCategories.id),
  fabricWeight: varchar("fabric_weight", { length: 50 }),
  priceMarkup: numeric("price_markup", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  hidden: boolean("hidden").notNull().default(false),
  viewerSettings: jsonb("viewer_settings"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const componentFabricRules = pgTable(
  "component_fabric_rules",
  {
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id),
    fabricCategoryId: uuid("fabric_category_id")
      .notNull()
      .references(() => fabricCategories.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.componentId, table.fabricCategoryId],
    }),
  ],
);
