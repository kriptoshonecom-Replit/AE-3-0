import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const productCatalogTable = pgTable("product_catalog", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
