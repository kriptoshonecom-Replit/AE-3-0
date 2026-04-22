import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { usersTable, productCatalogTable, pitCatalogTable, alertConfigsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_CATALOG } from "./lib/catalogSeed";
import { DEFAULT_PIT_CATALOG } from "./lib/pitCatalogSeed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

interface CatalogCategory {
  id: string;
  name: string;
  items: Record<string, unknown>[];
}

interface Catalog {
  categories: CatalogCategory[];
}

interface PitCategory {
  id: string;
  name: string;
  lineItems: Record<string, unknown>[];
}

interface PitCatalog {
  categories: PitCategory[];
  hourlyRate?: number;
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_catalog (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pit_catalog (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      original_name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_product_id TEXT NOT NULL,
      lookup_product_ids JSONB NOT NULL DEFAULT '[]',
      lookup_logic TEXT NOT NULL DEFAULT 'and',
      display_message TEXT NOT NULL DEFAULT '',
      delay_seconds INTEGER NOT NULL DEFAULT 5,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  await pool.query(`
    ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS lookup_logic TEXT NOT NULL DEFAULT 'and'
  `);
  logger.info("DB migrations complete");
}

async function bootstrapCatalog() {
  try {
    const existing = await db
      .select({ id: productCatalogTable.id })
      .from(productCatalogTable)
      .limit(1);

    if (existing.length === 0) {
      await db.insert(productCatalogTable).values({
        id: "catalog",
        data: DEFAULT_CATALOG as unknown as Record<string, unknown>,
      });
      logger.info("Product catalog seeded from defaults");
      return;
    }

    const [row] = await db
      .select()
      .from(productCatalogTable)
      .where(eq(productCatalogTable.id, "catalog"))
      .limit(1);

    if (!row) return;

    const stored = row.data as Catalog;
    const existingIds = new Set(stored.categories.map((c) => c.id));
    const defaultCatalog = DEFAULT_CATALOG as unknown as Catalog;
    const missing = defaultCatalog.categories.filter((c) => !existingIds.has(c.id));

    if (missing.length > 0) {
      stored.categories.push(...missing);
      await db
        .update(productCatalogTable)
        .set({ data: stored as unknown as Record<string, unknown>, updatedAt: new Date() })
        .where(eq(productCatalogTable.id, "catalog"));
      logger.info({ added: missing.map((c) => c.id) }, "Catalog migration: added missing categories");
    }
  } catch (err) {
    logger.error(err, "Catalog bootstrap failed");
  }
}

async function bootstrapPitCatalog() {
  try {
    const existing = await db
      .select({ id: pitCatalogTable.id })
      .from(pitCatalogTable)
      .limit(1);

    if (existing.length === 0) {
      await db.insert(pitCatalogTable).values({
        id: "catalog",
        data: DEFAULT_PIT_CATALOG as unknown as Record<string, unknown>,
      });
      logger.info("PIT catalog seeded from defaults");
      return;
    }

    const [row] = await db
      .select()
      .from(pitCatalogTable)
      .where(eq(pitCatalogTable.id, "catalog"))
      .limit(1);

    if (!row) return;

    const stored = row.data as PitCatalog;
    let dirty = false;

    const existingIds = new Set(stored.categories.map((c) => c.id));
    const defaultPit = DEFAULT_PIT_CATALOG as unknown as PitCatalog;
    const missing = defaultPit.categories.filter((c) => !existingIds.has(c.id));
    if (missing.length > 0) {
      stored.categories.push(...missing);
      dirty = true;
      logger.info({ added: missing.map((c) => c.id) }, "PIT catalog migration: added missing categories");
    }

    if (stored.hourlyRate === undefined) {
      stored.hourlyRate = 120.0;
      dirty = true;
      logger.info("PIT catalog migration: added default hourlyRate");
    }

    if (dirty) {
      await db
        .update(pitCatalogTable)
        .set({ data: stored as unknown as Record<string, unknown>, updatedAt: new Date() })
        .where(eq(pitCatalogTable.id, "catalog"));
    }
  } catch (err) {
    logger.error(err, "PIT catalog bootstrap failed");
  }
}

async function bootstrapAdmin() {
  const bootstrapEmail = process.env["ADMIN_BOOTSTRAP_EMAIL"];
  if (!bootstrapEmail) return;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));

    if (count === 0) {
      const [promoted] = await db
        .update(usersTable)
        .set({ role: "admin" })
        .where(eq(usersTable.email, bootstrapEmail.toLowerCase().trim()))
        .returning({ email: usersTable.email });

      if (promoted) {
        logger.info({ email: promoted.email }, "Admin bootstrap: promoted user to admin");
      } else {
        logger.warn({ email: bootstrapEmail }, "Admin bootstrap: user not found");
      }
    }
  } catch (err) {
    logger.error(err, "Admin bootstrap failed");
  }
}

async function bootstrapLicenseAlert() {
  try {
    const existing = await db
      .select({ id: alertConfigsTable.id })
      .from(alertConfigsTable)
      .where(eq(alertConfigsTable.subjectProductId, "co-001"))
      .limit(1);

    if (existing.length > 0) return;

    await db.insert(alertConfigsTable).values({
      subjectProductId: "co-001",
      lookupProductIds: ["tm-001", "tm-002", "ta-001", "ta-002", "ta-003"],
      lookupLogic: "and",
      displayMessage:
        "Please ensure the number of Aloha Essentials licenses matches the total number of terminals and tablets.",
      delaySeconds: 5,
      isActive: true,
    });
    logger.info("License alert seeded");
  } catch (err) {
    logger.error(err, "License alert bootstrap failed");
  }
}

async function start() {
  await runMigrations();
  await bootstrapCatalog();
  await bootstrapPitCatalog();
  await bootstrapAdmin();
  await bootstrapLicenseAlert();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
