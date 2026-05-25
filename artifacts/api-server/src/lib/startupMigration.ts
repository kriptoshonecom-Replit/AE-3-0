/**
 * Startup migrations — all idempotent, run in background on every startup.
 *
 * 1. migrateFilesystemImages — uploads legacy product images to GCS.
 * 2. backfillCustomers — seeds the customers table from existing quotes and
 *    removes garbage partial-MCN records (no company/name/email).
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { db } from "@workspace/db";
import { mediaFilesTable } from "@workspace/db/schema";
import { uploadProductImage, listProductImageSlugs } from "./productImages";
import { logger } from "./logger";
import { pool } from "@workspace/db";

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

/**
 * Backfill the customers table from existing quotes, and remove garbage
 * partial-MCN rows that have no company, name, or email.
 *
 * Idempotent — safe to run on every startup.
 */
export async function backfillCustomers(): Promise<void> {
  try {
    // 1. Remove garbage records created by partial-MCN auto-saves
    const del = await pool.query(`
      DELETE FROM customers
      WHERE (company_name IS NULL OR company_name = '')
        AND (customer_name IS NULL  OR customer_name  = '')
        AND (customer_email IS NULL OR customer_email = '');
    `);
    if ((del.rowCount ?? 0) > 0) {
      logger.info({ deleted: del.rowCount }, "customer-backfill: removed partial-MCN ghost records");
    }

    // 2. Seed customers from existing quotes (fills gaps, never overwrites good data)
    const ins = await pool.query(`
      INSERT INTO customers (id, company_name, customer_name, customer_email,
                             customer_phone, mcn, creator_user_id, created_at, updated_at)
      SELECT key, company_name, customer_name, customer_email,
             customer_phone, mcn, creator_user_id, created_at, updated_at
      FROM (
        SELECT
          CASE
            WHEN trim(coalesce(data->'meta'->>'mcn', '')) != ''
              AND (
                trim(coalesce(data->'meta'->>'companyName', '')) != '' OR
                trim(coalesce(data->'meta'->>'customerName', '')) != '' OR
                lower(trim(coalesce(data->'meta'->>'customerEmail', ''))) != ''
              )
              THEN trim(data->'meta'->>'mcn')
            WHEN lower(trim(coalesce(data->'meta'->>'customerEmail', ''))) != ''
              THEN lower(trim(data->'meta'->>'customerEmail'))
            WHEN trim(coalesce(data->'meta'->>'companyName', '')) != ''
              OR  trim(coalesce(data->'meta'->>'customerName', '')) != ''
              THEN trim(coalesce(data->'meta'->>'companyName', '')) || '___' ||
                   trim(coalesce(data->'meta'->>'customerName', ''))
            ELSE NULL
          END AS key,
          data->'meta'->>'companyName'                                    AS company_name,
          data->'meta'->>'customerName'                                   AS customer_name,
          lower(trim(coalesce(data->'meta'->>'customerEmail', '')))       AS customer_email,
          data->'meta'->>'customerPhone'                                  AS customer_phone,
          data->'meta'->>'mcn'                                            AS mcn,
          user_id::uuid                                                   AS creator_user_id,
          created_at,
          updated_at
        FROM quotes
        WHERE data->'meta' IS NOT NULL
        ORDER BY created_at ASC
      ) sub
      WHERE key IS NOT NULL AND key != '___'
      ON CONFLICT (id) DO UPDATE SET
        company_name   = COALESCE(NULLIF(EXCLUDED.company_name,   ''), customers.company_name),
        customer_name  = COALESCE(NULLIF(EXCLUDED.customer_name,  ''), customers.customer_name),
        customer_email = COALESCE(NULLIF(EXCLUDED.customer_email, ''), customers.customer_email),
        customer_phone = COALESCE(NULLIF(EXCLUDED.customer_phone, ''), customers.customer_phone),
        mcn            = COALESCE(NULLIF(EXCLUDED.mcn,            ''), customers.mcn),
        updated_at     = GREATEST(customers.updated_at, EXCLUDED.updated_at);
    `);
    logger.info({ upserted: ins.rowCount }, "customer-backfill: complete");
  } catch (err) {
    logger.warn(err, "customer-backfill: error (non-fatal)");
  }
}
