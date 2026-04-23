import { pgTable, text, timestamp, uuid, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const alertConfigsTable = pgTable("alert_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectProductId: text("subject_product_id").notNull(),
  lookupProductIds: jsonb("lookup_product_ids").$type<string[]>().notNull().default([]),
  displayMessage: text("display_message").notNull().default(""),
  delaySeconds: integer("delay_seconds").notNull().default(5),
  lookupLogic: text("lookup_logic").notNull().default("and"),
  isActive: boolean("is_active").notNull().default(true),
  infoOnly: boolean("info_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AlertConfig = typeof alertConfigsTable.$inferSelect;
export type NewAlertConfig = typeof alertConfigsTable.$inferInsert;
