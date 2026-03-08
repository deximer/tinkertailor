import { pgTable, uuid, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { components } from "./components";

export const fabricWeightEnum = ["heavy", "light", "standard"] as const;
export type FabricWeight = (typeof fabricWeightEnum)[number];

export const componentMeshes = pgTable(
  "component_meshes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    fabricWeight: varchar("fabric_weight", { length: 20 }).notNull().$type<FabricWeight>(),
    // Path within Supabase Storage (e.g. "models/tops/TT-PAT-SIL-027-.../...heavy.obj").
    storagePath: varchar("storage_path", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("component_meshes_component_weight_idx").on(
      table.componentId,
      table.fabricWeight,
    ),
  ],
);
