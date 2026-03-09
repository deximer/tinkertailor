import { pgTable, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { garmentTypes } from "./garment-types";
import { garmentParts } from "./garment-parts";

export const garmentTypeParts = pgTable(
  "garment_type_parts",
  {
    garmentTypeId: uuid("garment_type_id")
      .notNull()
      .references(() => garmentTypes.id, { onDelete: "cascade" }),
    garmentPartId: uuid("garment_part_id")
      .notNull()
      .references(() => garmentParts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.garmentTypeId, table.garmentPartId] }),
  ],
);
