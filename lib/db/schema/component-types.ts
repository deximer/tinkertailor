import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { garmentParts } from "./garment-parts";

// Legacy enums — kept during migration, will be removed when old columns are dropped.
export const componentDesignStageEnum = ["silhouette", "embellishment", "finishing"] as const;
export type ComponentDesignStage = (typeof componentDesignStageEnum)[number];

export const garmentPartEnum = ["bodice", "skirt", "sleeve", "embellishment", "finishing"] as const;
export type GarmentPart = (typeof garmentPartEnum)[number];

export const componentTypes = pgTable("component_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  // New FK — canonical garment part reference
  garmentPartId: uuid("garment_part_id").references(() => garmentParts.id),
  // Legacy columns — kept during migration, dropped after API/UI updated
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  designStage: varchar("design_stage", { length: 20 }).notNull().$type<ComponentDesignStage>(),
  isAnchor: boolean("is_anchor").notNull().default(false),
  garmentPart: varchar("garment_part", { length: 20 }).$type<GarmentPart>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
