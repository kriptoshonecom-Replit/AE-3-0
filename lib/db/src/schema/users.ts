import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
