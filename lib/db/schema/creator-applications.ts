import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);

export type ApplicationStatus =
  (typeof applicationStatusEnum.enumValues)[number];

export const creatorApplications = pgTable("creator_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => profiles.id)
    .notNull()
    .unique(),
  status: applicationStatusEnum("status").notNull().default("pending"),
  name: text("name").notNull(),
  bio: text("bio").notNull(),
  instagramUrl: text("instagram_url"),
  tiktokUrl: text("tiktok_url"),
  portfolioUrl: text("portfolio_url"),
  adminNote: text("admin_note"),
  reviewedBy: uuid("reviewed_by").references(() => profiles.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type CreatorApplication = typeof creatorApplications.$inferSelect;
export type NewCreatorApplication = typeof creatorApplications.$inferInsert;
