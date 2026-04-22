/**
 * Startup migration: uploads any legacy filesystem product images to GCS
 * and registers them in the media_files DB table.
 *
 * Safe to run on every startup — idempotent (skips files already in GCS/DB).
 * Runs in the background so it never delays server startup.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { db } from "@workspace/db";
import { mediaFilesTable } from "@workspace/db/schema";
import { uploadProductImage, listProductImageSlugs } from "./productImages";
import { logger } from "./logger";

export async function migrateFilesystemImages(appRoot: string): Promise<void> {
  const imageDirs = [
    join(appRoot, "../quote-builder/public/products"),
    join(appRoot, "uploads/products"),
  ];

  let gcsSlugs: string[];
  try {
    gcsSlugs = await listProductImageSlugs();
  } catch (err) {
    logger.warn(err, "startup-migration: could not list GCS files, skipping");
    return;
  }

  const gcsSet = new Set(gcsSlugs);

  for (const dir of imageDirs) {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }

    const pngFiles = files.filter((f) => f.toLowerCase().endsWith(".png"));
    if (pngFiles.length === 0) continue;

    logger.info({ dir, count: pngFiles.length }, "startup-migration: scanning");

    for (const filename of pngFiles) {
      try {
        if (!gcsSet.has(filename)) {
          const buffer = await readFile(join(dir, filename));
          await uploadProductImage(filename, buffer);
          gcsSet.add(filename);
          logger.info({ filename }, "startup-migration: uploaded to GCS");
        }

        await db
          .insert(mediaFilesTable)
          .values({
            originalName: filename,
            slug: filename,
            path: `/api/images/products/${filename}`,
          })
          .onConflictDoNothing();
      } catch (err) {
        logger.warn({ err, filename }, "startup-migration: error processing file");
      }
    }
  }

  logger.info("startup-migration: complete");
}
