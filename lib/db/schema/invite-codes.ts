import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { userRoleEnum } from "./profiles";
import { profiles } from "./profiles";

export const inviteCodes = pgTable("invite_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  role: userRoleEnum("role").notNull(),
  createdBy: uuid("created_by").references(() => profiles.id),
  usedBy: uuid("used_by").references(() => profiles.id),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;
