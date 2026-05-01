import { Router } from "express";
import { db } from "@workspace/db";
import { productCatalogTable, pitCatalogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { DEFAULT_CATALOG } from "../lib/catalogSeed";
import { DEFAULT_PIT_CATALOG } from "../lib/pitCatalogSeed";

const router = Router();
const CATALOG_ID = "catalog";

router.get("/products", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(productCatalogTable)
      .where(eq(productCatalogTable.id, CATALOG_ID))
      .limit(1);

    if (!row) {
      res.json({ ...DEFAULT_CATALOG, tieredAdditionalPrice: 30 });
      return;
    }

    const data = row.data as Record<string, unknown>;
    if (data.tieredAdditionalPrice === undefined) data.tieredAdditionalPrice = 30;
    res.json(data);
  } catch (err) {
    logger.error(err, "get products error");
    res.status(500).json({ error: "Failed to load products" });
  }
});

router.get("/pit-services", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(pitCatalogTable)
      .where(eq(pitCatalogTable.id, CATALOG_ID))
      .limit(1);

    if (!row) {
      res.json({ ...DEFAULT_PIT_CATALOG, hourlyRate: 120.0 });
      return;
    }

    const data = row.data as Record<string, unknown>;
    if (data.hourlyRate === undefined) data.hourlyRate = 120.0;
    res.json(data);
  } catch (err) {
    logger.error(err, "get pit-services error");
    res.status(500).json({ error: "Failed to load PIT catalog" });
  }
});

export default router;
