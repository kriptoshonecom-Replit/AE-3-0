import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const statusPassConfigTable = pgTable("status_pass_config", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull().$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
