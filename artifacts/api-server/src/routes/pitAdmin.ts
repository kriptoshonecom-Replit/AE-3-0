import { Router } from "express";
import { db } from "@workspace/db";
import { pitCatalogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { DEFAULT_PIT_CATALOG } from "../lib/pitCatalogSeed";

const router = Router();
router.use(requireAdmin);

const PIT_ID = "catalog";
const DEFAULT_HOURLY_RATE = 120.0;

interface PitLineItem {
  id: string;
  name: string;
  duration?: number;
  price?: number;
}

interface PitCategory {
  id: string;
  name: string;
  lineItems: PitLineItem[];
}

interface PitCatalog {
  categories: PitCategory[];
  hourlyRate?: number;
}

async function readCatalog(): Promise<PitCatalog> {
  const [row] = await db
    .select()
    .from(pitCatalogTable)
    .where(eq(pitCatalogTable.id, PIT_ID))
    .limit(1);
  const data = (row?.data ?? DEFAULT_PIT_CATALOG) as PitCatalog;
  if (data.hourlyRate === undefined) data.hourlyRate = DEFAULT_HOURLY_RATE;
  return data;
}

async function writeCatalog(data: PitCatalog): Promise<PitCatalog> {
  await db
    .insert(pitCatalogTable)
    .values({ id: PIT_ID, data: data as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: pitCatalogTable.id,
      set: { data: data as unknown as Record<string, unknown>, updatedAt: new Date() },
    });
  return data;
}

/* ── GET /api/admin/pit ─────────────────────────────────── */
router.get("/pit", async (_req, res) => {
  try {
    res.json(await readCatalog());
  } catch {
    res.status(500).json({ error: "Failed to load PIT catalog" });
  }
});

/* ── PATCH /api/admin/pit/rate ──────────────────────────── */
router.patch("/pit/rate", async (req, res) => {
  const { hourlyRate } = req.body as { hourlyRate?: number };
  const rate = Number(hourlyRate);
  if (Number.isNaN(rate) || rate <= 0) {
    res.status(400).json({ error: "hourlyRate must be a positive number" });
    return;
  }
  try {
    const catalog = await readCatalog();
    catalog.hourlyRate = rate;
    res.json(await writeCatalog(catalog));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

/* ── POST /api/admin/pit/categories ─────────────────────── */
router.post("/pit/categories", async (req, res) => {
  const { id, name } = req.body as { id?: string; name?: string; type?: string };
  if (!id?.trim() || !name?.trim()) {
    res.status(400).json({ error: "ID and name are required" });
    return;
  }
  try {
    const catalog = await readCatalog();
    if (catalog.categories.some((c) => c.id === id.trim())) {
      res.status(409).json({ error: "Category ID already exists" });
      return;
    }
    catalog.categories.push({ id: id.trim(), name: name.trim(), lineItems: [] });
    res.json(await writeCatalog(catalog));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

/* ── POST /api/admin/pit/categories/:catId/items ─────────── */
router.post("/pit/categories/:catId/items", async (req, res) => {
  const { catId } = req.params as { catId: string };
  const { id, name, duration, price } = req.body as {
    id?: string; name?: string; duration?: number; price?: number;
  };
  if (!id?.trim() || !name?.trim()) {
    res.status(400).json({ error: "ID and name are required" });
    return;
  }
  try {
    const catalog = await readCatalog();
    const cat = catalog.categories.find((c) => c.id === catId);
    if (!cat) { res.status(404).json({ error: "Category not found" }); return; }

    const allIds = catalog.categories.flatMap((c) => c.lineItems.map((i) => i.id));
    if (allIds.includes(id.trim())) {
      res.status(409).json({ error: "Item ID already exists" });
      return;
    }

    const newItem: PitLineItem = { id: id.trim(), name: name.trim() };
    if (duration !== undefined && Number(duration) > 0) newItem.duration = Number(duration);
    if (price !== undefined && Number(price) > 0) newItem.price = Number(price);
    cat.lineItems.push(newItem);
    res.json(await writeCatalog(catalog));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

/* ── PATCH /api/admin/pit/categories/:catId/items/:itemId ── */
router.patch("/pit/categories/:catId/items/:itemId", async (req, res) => {
  const { catId, itemId } = req.params as { catId: string; itemId: string };
  const { name, duration, price } = req.body as {
    name?: string; duration?: number; price?: number;
  };
  try {
    const catalog = await readCatalog();
    const cat = catalog.categories.find((c) => c.id === catId);
    if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
    const item = cat.lineItems.find((i) => i.id === itemId);
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    if (name !== undefined) item.name = name.trim() || item.name;
    if (duration !== undefined) item.duration = Number(duration) || 0;
    if (price !== undefined) item.price = Number(price) || 0;
    res.json(await writeCatalog(catalog));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

/* ── DELETE /api/admin/pit/categories/:catId/items/:itemId ── */
router.delete("/pit/categories/:catId/items/:itemId", async (req, res) => {
  const { catId, itemId } = req.params as { catId: string; itemId: string };
  try {
    const catalog = await readCatalog();
    const cat = catalog.categories.find((c) => c.id === catId);
    if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
    const before = cat.lineItems.length;
    cat.lineItems = cat.lineItems.filter((i) => i.id !== itemId);
    if (cat.lineItems.length === before) { res.status(404).json({ error: "Item not found" }); return; }
    res.json(await writeCatalog(catalog));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
