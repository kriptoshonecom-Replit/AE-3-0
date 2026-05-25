import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const customersTable = pgTable("customers", {
  id: text("id").primaryKey(),
  companyName: text("company_name"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  mcn: text("mcn"),
  address: jsonb("address").$type<Record<string, string> | null>(),
  billingAddress: jsonb("billing_address").$type<Record<string, string> | null>(),
  creatorUserId: uuid("creator_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CustomerRow = typeof customersTable.$inferSelect;
export type NewCustomerRow = typeof customersTable.$inferInsert;
