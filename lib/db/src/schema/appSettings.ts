import { pgTable, integer, text, jsonb } from "drizzle-orm/pg-core";

export const brandSettingsTable = pgTable("brand_settings", {
  id: integer("id").primaryKey().default(1),
  appName: text("app_name").notNull().default("Aloha WebCalculator"),
  mainLogoUrl: text("main_logo_url"),
  smallLogoUrl: text("small_logo_url"),
  accentColor: text("accent_color").notNull().default("#7c3aed"),
  disabledGroupIds: jsonb("disabled_group_ids").$type<string[]>().notNull().default([]),
});

export type BrandSettings = typeof brandSettingsTable.$inferSelect;
export type NewBrandSettings = typeof brandSettingsTable.$inferInsert;
