import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const mediaFilesTable = pgTable("media_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  originalName: text("original_name").notNull(),
  slug: text("slug").notNull().unique(),
  path: text("path").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MediaFile = typeof mediaFilesTable.$inferSelect;
export type NewMediaFile = typeof mediaFilesTable.$inferInsert;
