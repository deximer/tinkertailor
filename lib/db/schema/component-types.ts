import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { categories } from "./categories";

export const componentStageEnum = ["silhouette", "embellishment", "finishing"] as const;
export type ComponentStage = (typeof componentStageEnum)[number];

export const garmentPartEnum = ["bodice", "skirt", "sleeve", "embellishment", "finishing"] as const;
export type GarmentPart = (typeof garmentPartEnum)[number];

export const componentTypes = pgTable("component_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  stage: varchar("stage", { length: 20 }).notNull().$type<ComponentStage>(),
  isFirstLeaf: boolean("is_first_leaf").notNull().default(false),
  garmentPart: varchar("garment_part", { length: 20 }).$type<GarmentPart>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
