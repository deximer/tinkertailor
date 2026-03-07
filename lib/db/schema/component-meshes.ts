import { pgTable, uuid, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { components } from "./components";

// Fabric weight variants. 'heavy' = woven/structured drape; 'light' = knit/lightweight drape.
// Chosen at render time based on the fabric skin's meshVariant.
export const meshVariantEnum = ["heavy", "light", "standard"] as const;
export type MeshVariant = (typeof meshVariantEnum)[number];

export const componentMeshes = pgTable(
  "component_meshes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    // Which fabric-weight variant this mesh represents.
    variant: varchar("variant", { length: 20 }).notNull().$type<MeshVariant>(),
    // Path within Supabase Storage (e.g. "models/tops/TT-PAT-SIL-027-.../...heavy.obj").
    storagePath: varchar("storage_path", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("component_meshes_component_variant_idx").on(
      table.componentId,
      table.variant,
    ),
  ],
);
