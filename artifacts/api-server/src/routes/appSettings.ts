import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { brandSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";
import { uploadLogoImage, serveLogoImage } from "../lib/logoImages";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

async function getOrCreateSettings() {
  const rows = await db.select().from(brandSettingsTable).where(eq(brandSettingsTable.id, 1)).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db
    .insert(brandSettingsTable)
    .values({ id: 1, appName: "Aloha WebCalculator", accentColor: "#7c3aed", disabledGroupIds: [] })
    .returning();
  return created;
}

/* GET /api/settings — public, returns current app settings */
router.get("/settings", async (_req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (err) {
    logger.error(err, "GET /settings error");
    res.status(500).json({ error: "Failed to load settings" });
  }
});

/* PUT /api/settings — admin only, update name / accent / disabled groups */
router.put("/settings", requireAdmin, async (req, res) => {
  const body = req.body as {
    appName?: string;
    accentColor?: string;
    disabledGroupIds?: string[];
    mainLogoUrl?: string;
    smallLogoUrl?: string;
  };
  try {
    await getOrCreateSettings();
    const updates: Partial<typeof brandSettingsTable.$inferInsert> = {};
    if (body.appName !== undefined) updates.appName = body.appName.trim() || "Aloha WebCalculator";
    if (body.accentColor !== undefined) updates.accentColor = body.accentColor;
    if (body.disabledGroupIds !== undefined) updates.disabledGroupIds = body.disabledGroupIds;
    if (body.mainLogoUrl !== undefined) updates.mainLogoUrl = body.mainLogoUrl;
    if (body.smallLogoUrl !== undefined) updates.smallLogoUrl = body.smallLogoUrl;

    const [updated] = await db
      .update(brandSettingsTable)
      .set(updates)
      .where(eq(brandSettingsTable.id, 1))
      .returning();
    res.json(updated);
  } catch (err) {
    logger.error(err, "PUT /settings error");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

/* POST /api/settings/upload-logo?type=main|small — admin, upload logo to GCS */
router.post("/settings/upload-logo", requireAdmin, upload.single("file"), async (req, res) => {
  const type = (req.query.type as string) === "small" ? "small" : "main";
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  try {
    const contentType = req.file.mimetype || "image/png";
    await uploadLogoImage(type, req.file.buffer, contentType);

    const logoUrl = `/api/images/logos/${type}`;
    await getOrCreateSettings();
    const field = type === "small" ? "smallLogoUrl" : "mainLogoUrl";
    const [updated] = await db
      .update(brandSettingsTable)
      .set({ [field]: logoUrl })
      .where(eq(brandSettingsTable.id, 1))
      .returning();
    res.json({ url: logoUrl, settings: updated });
  } catch (err) {
    logger.error(err, "POST /settings/upload-logo error");
    res.status(500).json({ error: "Logo upload failed" });
  }
});

/* GET /api/images/logos/:type — public, serve logo from GCS */
router.get("/images/logos/:type", async (req, res) => {
  const type = req.params.type === "small" ? "small" : "main";
  try {
    await serveLogoImage(type, res);
  } catch (err) {
    logger.error(err, "GET /images/logos/:type error");
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve logo" });
  }
});

export default router;
