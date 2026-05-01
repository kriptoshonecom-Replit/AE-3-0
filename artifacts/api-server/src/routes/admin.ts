import { Router } from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import { db } from "@workspace/db";
import { usersTable, productCatalogTable } from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";
import { sendWelcomeEmail } from "../lib/email";
import { DEFAULT_CATALOG } from "../lib/catalogSeed";
import { uploadProductImage } from "../lib/productImages";

const router = Router();
router.use(requireAdmin);

const BCRYPT_ROUNDS = 10;
const CATALOG_ID = "catalog";

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

function isStrongPassword(pw: string): boolean {
  return (
    pw.length >= 8 &&
    /[A-Za-z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

function userDto(u: typeof usersTable.$inferSelect) {
  return { id: u.id, email: u.email, fullName: u.fullName, role: u.role, createdAt: u.createdAt };
}

/* ── Products (DB-backed) ─────────────────────────────── */

interface ProductItem {
  id: string;
  name: string;
  type?: string;
  text?: string;
  image?: string;
  price: number;
  pci?: number;
  hwmc?: number;
  produration?: number;
  traduration?: number;
  instaduration?: number;
  stageduration?: number;
  [key: string]: unknown;
}

interface Category {
  id: string;
  name: string;
  items: ProductItem[];
}

type ProductsData = { categories: Category[]; tieredAdditionalPrice?: number };

async function readProducts(): Promise<ProductsData> {
  const [row] = await db
    .select()
    .from(productCatalogTable)
    .where(eq(productCatalogTable.id, CATALOG_ID))
    .limit(1);

  if (!row) {
    const seed = DEFAULT_CATALOG as unknown as ProductsData;
    await db
      .insert(productCatalogTable)
      .values({ id: CATALOG_ID, data: seed as unknown as Record<string, unknown> });
    logger.info("Product catalog seeded from defaults");
    return seed;
  }

  return row.data as ProductsData;
}

async function writeProducts(data: ProductsData) {
  await db
    .insert(productCatalogTable)
    .values({ id: CATALOG_ID, data: data as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: productCatalogTable.id,
      set: {
        data: data as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });
}

/* ── Users ────────────────────────────────────────────── */

router.get("/users", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users.map(userDto));
  } catch (err) {
    logger.error(err, "admin list users error");
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!fullName?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: "fullName, email, and password are required" });
      return;
    }

    if (!isStrongPassword(password)) {
      res.status(400).json({
        error: "Password must be at least 8 characters and include a letter, a number, and a special character",
      });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const assignedRole = role === "admin" ? "admin" : "user";

    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase().trim(), passwordHash, fullName: fullName.trim(), role: assignedRole })
      .returning();

    sendWelcomeEmail(user.email, user.fullName, password).catch((err) => {
      logger.error(err, "welcome email failed");
    });

    res.status(201).json(userDto(user));
  } catch (err) {
    logger.error(err, "admin create user error");
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, newPassword } = req.body as {
      fullName?: string;
      email?: string;
      role?: string;
      newPassword?: string;
    };

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const updates: Partial<typeof usersTable.$inferInsert> = {};

    if (fullName?.trim()) updates.fullName = fullName.trim();

    if (email?.trim()) {
      const normalised = email.toLowerCase().trim();
      if (normalised !== user.email) {
        const conflict = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, normalised))
          .limit(1);
        if (conflict.length > 0) { res.status(409).json({ error: "That email is already in use" }); return; }
        updates.email = normalised;
      }
    }

    if (role && ["user", "admin"].includes(role)) updates.role = role;

    if (newPassword) {
      if (!isStrongPassword(newPassword)) {
        res.status(400).json({ error: "Password must be 8+ chars with a letter, number, and special character" });
        return;
      }
      updates.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    }

    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    res.json(userDto(updated));
  } catch (err) {
    logger.error(err, "admin update user error");
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.auth!.userId) { res.status(400).json({ error: "You cannot delete your own account" }); return; }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error(err, "admin delete user error");
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ── Products routes ──────────────────────────────────── */

router.post("/products/upload-image", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const dims = parsePngDimensions(file.buffer);
    if (!dims) { res.status(400).json({ error: "File must be a valid PNG image" }); return; }
    if (dims.width > 500 || dims.height > 500) {
      res.status(400).json({ error: `Image must be 500×500 px or smaller (uploaded: ${dims.width}×${dims.height})` });
      return;
    }

    const slug = (file.originalname.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").toLowerCase() || "product") + "-" + Date.now() + ".png";

    await uploadProductImage(slug, file.buffer);

    res.json({ path: `/api/images/products/${slug}` });
  } catch (err) {
    logger.error(err, "image upload error");
    res.status(500).json({ error: "Upload failed" });
  }
});

router.get("/products", async (_req, res) => {
  try {
    const data = await readProducts();
    res.json(data);
  } catch (err) {
    logger.error(err, "admin get products error");
    res.status(500).json({ error: "Failed to read products" });
  }
});

router.patch("/products/settings", async (req, res) => {
  try {
    const { tieredAdditionalPrice } = req.body as { tieredAdditionalPrice?: number };
    if (tieredAdditionalPrice !== undefined && (isNaN(tieredAdditionalPrice) || tieredAdditionalPrice < 0)) {
      res.status(400).json({ error: "tieredAdditionalPrice must be a non-negative number" });
      return;
    }
    const data = await readProducts();
    if (tieredAdditionalPrice !== undefined) data.tieredAdditionalPrice = tieredAdditionalPrice;
    await writeProducts(data);
    res.json({ tieredAdditionalPrice: data.tieredAdditionalPrice ?? 30 });
  } catch (err) {
    logger.error(err, "admin patch products settings error");
    res.status(500).json({ error: "Failed to update product settings" });
  }
});

router.post("/products/categories", async (req, res) => {
  try {
    const { id, name } = req.body as { id?: string; name?: string };
    if (!id?.trim() || !name?.trim()) { res.status(400).json({ error: "id and name are required" }); return; }
    const data = await readProducts();
    if (data.categories.find((c) => c.id === id.trim())) {
      res.status(409).json({ error: "Category ID already exists" }); return;
    }
    data.categories.push({ id: id.trim(), name: name.trim(), items: [] });
    await writeProducts(data);
    res.json(data);
  } catch (err) {
    logger.error(err, "admin add category error");
    res.status(500).json({ error: "Failed to add category" });
  }
});

router.patch("/products/categories/:catId", async (req, res) => {
  try {
    const { catId } = req.params;
    const { name } = req.body as { name?: string };
    const data = await readProducts();
    const cat = data.categories.find((c) => c.id === catId);
    if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
    if (name?.trim()) cat.name = name.trim();
    await writeProducts(data);
    res.json(data);
  } catch (err) {
    logger.error(err, "admin update category error");
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.post("/products/categories/:catId/items", async (req, res) => {
  try {
    const { catId } = req.params;
    const item = req.body as Partial<ProductItem>;
    if (!item.id?.trim() || !item.name?.trim()) { res.status(400).json({ error: "id and name are required" }); return; }
    const data = await readProducts();
    const cat = data.categories.find((c) => c.id === catId);
    if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
    if (cat.items.find((i) => i.id === item.id!.trim())) {
      res.status(409).json({ error: "Product ID already exists in this category" }); return;
    }
    const newItem: ProductItem = {
      id: item.id!.trim(),
      name: item.name!.trim(),
      type: item.type ?? "info",
      text: item.text ?? "",
      price: Number(item.price) || 0,
      pci: Number(item.pci) || 0,
      produration: Number(item.produration) || 0,
      traduration: Number(item.traduration) || 0,
      instaduration: Number(item.instaduration) || 0,
      stageduration: Number(item.stageduration) || 0,
    };
    if (item.image) newItem.image = item.image;
    cat.items.push(newItem);
    await writeProducts(data);
    res.json(data);
  } catch (err) {
    logger.error(err, "admin add product error");
    res.status(500).json({ error: "Failed to add product" });
  }
});

router.patch("/products/categories/:catId/items/:itemId", async (req, res) => {
  try {
    const { catId, itemId } = req.params;
    const updates = req.body as Partial<ProductItem>;
    const data = await readProducts();
    const cat = data.categories.find((c) => c.id === catId);
    if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
    const item = cat.items.find((i) => i.id === itemId);
    if (!item) { res.status(404).json({ error: "Product not found" }); return; }
    Object.assign(item, updates);
    if (updates.image === null) delete item.image;
    await writeProducts(data);
    res.json(data);
  } catch (err) {
    logger.error(err, "admin update product error");
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.patch("/products/categories/:catId/items/:itemId/move", async (req, res) => {
  try {
    const { catId, itemId } = req.params;
    const { targetCatId } = req.body as { targetCatId: string };
    if (!targetCatId?.trim()) { res.status(400).json({ error: "targetCatId is required" }); return; }
    if (catId === targetCatId) { res.status(400).json({ error: "Source and target category are the same" }); return; }
    const data = await readProducts();
    const sourceCat = data.categories.find((c) => String(c.id) === catId);
    if (!sourceCat) { res.status(404).json({ error: "Source category not found" }); return; }
    const targetCat = data.categories.find((c) => String(c.id) === targetCatId);
    if (!targetCat) { res.status(404).json({ error: "Target category not found" }); return; }
    // Use String coercion in case IDs were stored as numbers in JSONB
    const itemIdx = sourceCat.items.findIndex((i) => String(i.id) === itemId);
    if (itemIdx === -1) { res.status(404).json({ error: "Product not found in source category" }); return; }
    const [item] = sourceCat.items.splice(itemIdx, 1);
    // Dedup: remove any stale copy of this item from the target before inserting
    targetCat.items = targetCat.items.filter((i) => String(i.id) !== itemId);
    targetCat.items.push(item);
    await writeProducts(data);
    res.json(data);
  } catch (err) {
    logger.error(err, "admin move product error");
    res.status(500).json({ error: "Failed to move product" });
  }
});

router.delete("/products/categories/:catId", async (req, res) => {
  try {
    const { catId } = req.params;
    const data = await readProducts();
    data.categories = data.categories.filter((c) => c.id !== catId);
    await writeProducts(data);
    res.json(data);
  } catch (err) {
    logger.error(err, "admin delete category error");
    res.status(500).json({ error: "Failed to delete category" });
  }
});

router.delete("/products/categories/:catId/items/:itemId", async (req, res) => {
  try {
    const { catId, itemId } = req.params;
    const data = await readProducts();
    const cat = data.categories.find((c) => c.id === catId);
    if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
    cat.items = cat.items.filter((i) => i.id !== itemId);
    await writeProducts(data);
    res.json(data);
  } catch (err) {
    logger.error(err, "admin delete product error");
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
