import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const loginEventsTable = pgTable("login_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LoginEvent = typeof loginEventsTable.$inferSelect;
export type NewLoginEvent = typeof loginEventsTable.$inferInsert;
