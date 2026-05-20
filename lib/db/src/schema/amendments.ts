import { pgTable, text, timestamp, uuid, jsonb, varchar, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { quotesTable } from "./quotes";

export const amendmentsTable = pgTable("amendments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  originalQuoteId: varchar("original_quote_id", { length: 36 })
    .notNull()
    .references(() => quotesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  amendmentNumber: integer("amendment_number").notNull(),
  quoteNumber: text("quote_number"),
  originalQuoteNumber: text("original_quote_number"),
  companyName: text("company_name"),
  customerName: text("customer_name"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type AmendmentRow = typeof amendmentsTable.$inferSelect;
export type NewAmendmentRow = typeof amendmentsTable.$inferInsert;
