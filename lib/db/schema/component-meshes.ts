import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { components } from "./components";

export const meshVariantEnum = ["heavy", "light", "standard"] as const;
export type MeshVariant = (typeof meshVariantEnum)[number];

export const componentMeshes = pgTable("component_meshes", {
  id: uuid("id").defaultRandom().primaryKey(),
  componentId: uuid("component_id")
    .notNull()
    .references(() => components.id),
  variant: varchar("variant", { length: 20 }).notNull().$type<MeshVariant>(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
