import { pgTable, pgEnum, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "creator",
  "shopper",
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // FK to auth.users — set on insert, no defaultRandom
  role: userRoleEnum("role").notNull().default("shopper"),
  displayName: text("display_name"),
  handle: text("handle").unique(), // URL-slug for public profile, e.g. "jane-doe"
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
