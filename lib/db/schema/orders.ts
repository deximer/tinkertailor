import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const orderStatusEnum = [
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;
export type OrderStatus = (typeof orderStatusEnum)[number];

export const shipmentStatusEnum = [
  "pending",
  "submitted",
  "in_production",
  "shipped",
  "delivered",
] as const;
export type ShipmentStatus = (typeof shipmentStatusEnum)[number];

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  creatorId: uuid("creator_id"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
  status: varchar("status", { length: 20 })
    .notNull()
    .default("pending")
    .$type<OrderStatus>(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: jsonb("shipping_address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  icreateOrderId: varchar("icreate_order_id", { length: 100 }),
  shipstationShipmentId: varchar("shipstation_shipment_id", { length: 100 }),
  status: varchar("status", { length: 20 })
    .notNull()
    .default("pending")
    .$type<ShipmentStatus>(),
  trackingNumber: varchar("tracking_number", { length: 200 }),
  carrier: varchar("carrier", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
