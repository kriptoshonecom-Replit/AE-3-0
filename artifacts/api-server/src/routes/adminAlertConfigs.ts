import { Router } from "express";
import { db } from "@workspace/db";
import { alertConfigsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";

const router = Router();

// ── Public: active configs used by the QuoteBuilder at runtime ──────────────
router.get("/alert-configs", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const configs = await db
      .select()
      .from(alertConfigsTable)
      .where(eq(alertConfigsTable.isActive, true))
      .orderBy(asc(alertConfigsTable.createdAt));
    res.json(configs);
  } catch (err) {
    logger.error(err, "alert-configs list error");
    res.status(500).json({ error: "Failed to fetch alert configs" });
  }
});

// ── Admin-only CRUD ──────────────────────────────────────────────────────────
router.use("/admin/alert-configs", requireAdmin);

router.get("/admin/alert-configs", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const configs = await db
      .select()
      .from(alertConfigsTable)
      .orderBy(asc(alertConfigsTable.createdAt));
    res.json(configs);
  } catch (err) {
    logger.error(err, "admin alert-configs list error");
    res.status(500).json({ error: "Failed to fetch alert configs" });
  }
});

router.post("/admin/alert-configs", async (req, res) => {
  try {
    const {
      subjectProductId,
      lookupProductIds,
      displayMessage,
      delaySeconds,
      isActive,
    } = req.body as {
      subjectProductId: string;
      lookupProductIds: string[];
      displayMessage: string;
      delaySeconds?: number;
      isActive?: boolean;
    };

    if (!subjectProductId?.trim()) {
      res.status(400).json({ error: "subjectProductId is required" });
      return;
    }
    if (!Array.isArray(lookupProductIds) || lookupProductIds.length === 0) {
      res.status(400).json({ error: "lookupProductIds must be a non-empty array" });
      return;
    }

    const [row] = await db
      .insert(alertConfigsTable)
      .values({
        subjectProductId: subjectProductId.trim(),
        lookupProductIds,
        displayMessage: displayMessage?.trim() ?? "",
        delaySeconds: typeof delaySeconds === "number" ? delaySeconds : 5,
        isActive: isActive !== false,
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    logger.error(err, "alert-config create error");
    res.status(500).json({ error: "Failed to create alert config" });
  }
});

router.patch("/admin/alert-configs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subjectProductId,
      lookupProductIds,
      displayMessage,
      delaySeconds,
      isActive,
    } = req.body as Partial<{
      subjectProductId: string;
      lookupProductIds: string[];
      displayMessage: string;
      delaySeconds: number;
      isActive: boolean;
    }>;

    const existing = await db
      .select()
      .from(alertConfigsTable)
      .where(eq(alertConfigsTable.id, id))
      .limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Alert config not found" });
      return;
    }

    const updates: Partial<typeof alertConfigsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (subjectProductId !== undefined) updates.subjectProductId = subjectProductId.trim();
    if (lookupProductIds !== undefined) updates.lookupProductIds = lookupProductIds;
    if (displayMessage !== undefined) updates.displayMessage = displayMessage.trim();
    if (delaySeconds !== undefined) updates.delaySeconds = delaySeconds;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db
      .update(alertConfigsTable)
      .set(updates)
      .where(eq(alertConfigsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error(err, "alert-config update error");
    res.status(500).json({ error: "Failed to update alert config" });
  }
});

router.delete("/admin/alert-configs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db
      .select()
      .from(alertConfigsTable)
      .where(eq(alertConfigsTable.id, id))
      .limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Alert config not found" });
      return;
    }
    await db.delete(alertConfigsTable).where(eq(alertConfigsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error(err, "alert-config delete error");
    res.status(500).json({ error: "Failed to delete alert config" });
  }
});

export default router;
