import { pgTable, text, timestamp, uuid, jsonb, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const quotesTable = pgTable("quotes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  quoteNumber: text("quote_number"),
  companyName: text("company_name"),
  customerName: text("customer_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  updatedByUserId: uuid("updated_by_user_id").references(() => usersTable.id),
  updatedByName: text("updated_by_name"),
  passStatus: text("pass_status"),
});

export type QuoteRow = typeof quotesTable.$inferSelect;
export type NewQuoteRow = typeof quotesTable.$inferInsert;
