import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { componentTypes } from "./component-types";
import type { GarmentPart } from "./component-types";

export const components = pgTable("components", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  assetCode: varchar("asset_code", { length: 50 }).notNull().unique(),
  componentTypeId: uuid("component_type_id")
    .notNull()
    .references(() => componentTypes.id),
  modelPath: varchar("model_path", { length: 500 }),
  garmentPart: varchar("garment_part", { length: 20 }).$type<GarmentPart>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
