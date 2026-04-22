import { Router } from "express";
import multer from "multer";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { mediaFilesTable } from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";
import { uploadProductImage, deleteProductImage, listProductImageSlugs } from "../lib/productImages";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
router.use(requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  for (let i = 0; i < 8; i++) if (buf[i] !== PNG_SIG[i]) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

router.get("/media", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    // Auto-sync: register any GCS files not yet in the DB
    try {
      const gcsSlugs = await listProductImageSlugs();
      if (gcsSlugs.length > 0) {
        const existing = await db
          .select({ slug: mediaFilesTable.slug })
          .from(mediaFilesTable)
          .where(inArray(mediaFilesTable.slug, gcsSlugs));
        const existingSet = new Set(existing.map((r) => r.slug));
        const toInsert = gcsSlugs
          .filter((slug) => !existingSet.has(slug))
          .map((slug) => ({
            originalName: slug,
            slug,
            path: `/api/images/products/${slug}`,
          }));
        if (toInsert.length > 0) {
          await db.insert(mediaFilesTable).values(toInsert).onConflictDoNothing();
          logger.info({ count: toInsert.length }, "Auto-registered GCS images into media_files");
        }
      }
    } catch (syncErr) {
      logger.warn(syncErr, "GCS sync skipped (non-fatal)");
    }

    const files = await db
      .select()
      .from(mediaFilesTable)
      .orderBy(desc(mediaFilesTable.uploadedAt));
    res.json(files);
  } catch (err) {
    logger.error(err, "media list error");
    res.status(500).json({ error: "Failed to list media files" });
  }
});

// One-time migration: scan filesystem dirs, upload any missing files to GCS, register in DB
router.post("/media/migrate-filesystem", async (_req, res) => {
  // __dirname resolves to dist/ (esbuild single-file bundle output)
  const imageDirs = [
    join(__dirname, "../../quote-builder/public/products"),
    join(__dirname, "../uploads/products"),
  ];

  const report: { filename: string; status: string }[] = [];

  for (const dir of imageDirs) {
    let files: string[];
    try { files = await readdir(dir); }
    catch { continue; }

    const pngFiles = files.filter((f) => f.toLowerCase().endsWith(".png"));
    logger.info({ dir, count: pngFiles.length }, "Migrating filesystem images");

    for (const filename of pngFiles) {
      try {
        await uploadProductImage(filename, await readFile(join(dir, filename)));
        await db.insert(mediaFilesTable).values({
          originalName: filename,
          slug: filename,
          path: `/api/images/products/${filename}`,
        }).onConflictDoNothing();
        report.push({ filename, status: "migrated" });
      } catch (err) {
        logger.error(err, `migrate-filesystem failed for ${filename}`);
        report.push({ filename, status: `error: ${(err as Error).message}` });
      }
    }
  }

  logger.info({ count: report.length }, "migrate-filesystem complete");
  res.json({ migrated: report.length, report });
});

router.post("/media/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

    if (!file.name?.toLowerCase().endsWith(".png") && !file.originalname?.toLowerCase().endsWith(".png")) {
      res.status(400).json({ error: "Only PNG files are accepted" }); return;
    }

    const dims = parsePngDimensions(file.buffer);
    if (!dims) { res.status(400).json({ error: "File must be a valid PNG image" }); return; }
    if (dims.width > 500 || dims.height > 500) {
      res.status(400).json({ error: `Image must be 500×500 px or smaller (uploaded: ${dims.width}×${dims.height})` });
      return;
    }

    const baseName = file.originalname.replace(/\.png$/i, "").replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").toLowerCase() || "image";
    const slug = baseName + "-" + Date.now() + ".png";
    const path = `/api/images/products/${slug}`;

    await uploadProductImage(slug, file.buffer);

    const [row] = await db
      .insert(mediaFilesTable)
      .values({ originalName: file.originalname, slug, path })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    logger.error(err, "media upload error");
    res.status(500).json({ error: "Upload failed" });
  }
});

router.patch("/media/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { originalName } = req.body as { originalName?: string };
    if (!originalName?.trim()) { res.status(400).json({ error: "originalName is required" }); return; }

    const [row] = await db
      .select()
      .from(mediaFilesTable)
      .where(eq(mediaFilesTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Media file not found" }); return; }

    const [updated] = await db
      .update(mediaFilesTable)
      .set({ originalName: originalName.trim() })
      .where(eq(mediaFilesTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error(err, "media rename error");
    res.status(500).json({ error: "Failed to rename" });
  }
});

router.delete("/media/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [row] = await db
      .select()
      .from(mediaFilesTable)
      .where(eq(mediaFilesTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Media file not found" }); return; }

    await deleteProductImage(row.slug);
    await db.delete(mediaFilesTable).where(eq(mediaFilesTable.id, id));

    res.json({ success: true });
  } catch (err) {
    logger.error(err, "media delete error");
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
