import { Router } from "express";
import { db } from "@workspace/db";
import { productCatalogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { DEFAULT_CATALOG } from "../lib/catalogSeed";

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
      res.json(DEFAULT_CATALOG);
      return;
    }

    res.json(row.data);
  } catch (err) {
    logger.error(err, "get products error");
    res.status(500).json({ error: "Failed to load products" });
  }
});

export default router;
