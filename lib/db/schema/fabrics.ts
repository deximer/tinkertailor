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

export const fabricSkinCategories = pgTable("fabric_skin_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  parentId: uuid("parent_id").references((): AnyPgColumn => fabricSkinCategories.id),
  merchandisingOrder: integer("merchandising_order").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const fabricSkins = pgTable("fabric_skins", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  fabricCode: varchar("fabric_code", { length: 50 }).notNull().unique(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => fabricSkinCategories.id),
  modelType: varchar("model_type", { length: 50 }),
  priceMarkup: numeric("price_markup", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  hidden: boolean("hidden").notNull().default(false),
  viewerSettings: jsonb("viewer_settings"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const componentFabricCategories = pgTable(
  "component_fabric_categories",
  {
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id),
    fabricSkinCategoryId: uuid("fabric_skin_category_id")
      .notNull()
      .references(() => fabricSkinCategories.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.componentId, table.fabricSkinCategoryId],
    }),
  ],
);
