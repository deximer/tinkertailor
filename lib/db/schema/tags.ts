import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { silhouetteTemplates } from "./silhouettes";

export const tagSelectionTypeEnum = ["single", "multi"] as const;
export type TagSelectionType = (typeof tagSelectionTypeEnum)[number];

export const tagDimensions = pgTable("tag_dimensions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  selectionType: varchar("selection_type", { length: 20 })
    .notNull()
    .default("single")
    .$type<TagSelectionType>(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tagValues = pgTable("tag_values", {
  id: uuid("id").defaultRandom().primaryKey(),
  dimensionId: uuid("dimension_id")
    .notNull()
    .references(() => tagDimensions.id),
  label: varchar("label", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const silhouetteTags = pgTable(
  "silhouette_tags",
  {
    silhouetteId: uuid("silhouette_id")
      .notNull()
      .references(() => silhouetteTemplates.id),
    tagValueId: uuid("tag_value_id")
      .notNull()
      .references(() => tagValues.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.silhouetteId, table.tagValueId] }),
  ],
);
