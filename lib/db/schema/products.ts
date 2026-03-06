import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { silhouetteTemplates } from "./silhouettes";
import { components } from "./components";
import { fabricSkins } from "./fabrics";

export const productStatusEnum = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof productStatusEnum)[number];

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  silhouetteTemplateId: uuid("silhouette_template_id").references(
    () => silhouetteTemplates.id,
  ),
  name: varchar("name", { length: 200 }).notNull(),
  status: varchar("status", { length: 20 })
    .notNull()
    .default("draft")
    .$type<ProductStatus>(),
  shared: boolean("shared").notNull().default(false),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const productComponents = pgTable("product_components", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  componentId: uuid("component_id")
    .notNull()
    .references(() => components.id),
  fabricSkinId: uuid("fabric_skin_id").references(() => fabricSkins.id),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
