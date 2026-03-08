import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { components } from "./components";

export const fabricWeightEnum = ["heavy", "light", "standard"] as const;
export type FabricWeight = (typeof fabricWeightEnum)[number];

export const componentMeshes = pgTable("component_meshes", {
  id: uuid("id").defaultRandom().primaryKey(),
  componentId: uuid("component_id")
    .notNull()
    .references(() => components.id),
  fabricWeight: varchar("fabric_weight", { length: 20 }).notNull().$type<FabricWeight>(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
