import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { orders } from "./orders";

export const attributionLinks = pgTable("attribution_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  creatorId: uuid("creator_id").notNull(),
  slug: varchar("slug", { length: 20 }).notNull().unique(),
  clickCount: integer("click_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const attributionVisits = pgTable("attribution_visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  attributionLinkId: uuid("attribution_link_id")
    .notNull()
    .references(() => attributionLinks.id),
  orderId: uuid("order_id").references(() => orders.id),
  visitedAt: timestamp("visited_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ipHash: varchar("ip_hash", { length: 64 }),
});

export type AttributionLink = typeof attributionLinks.$inferSelect;
export type NewAttributionLink = typeof attributionLinks.$inferInsert;
export type AttributionVisit = typeof attributionVisits.$inferSelect;
export type NewAttributionVisit = typeof attributionVisits.$inferInsert;
