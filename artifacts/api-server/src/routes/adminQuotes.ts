import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

router.get("/admin/quotes", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: quotesTable.id,
        data: quotesTable.data,
        quoteNumber: quotesTable.quoteNumber,
        companyName: quotesTable.companyName,
        customerName: quotesTable.customerName,
        createdAt: quotesTable.createdAt,
        updatedAt: quotesTable.updatedAt,
        updatedByName: quotesTable.updatedByName,
        passStatus: quotesTable.passStatus,
        userId: quotesTable.userId,
        creatorName: usersTable.fullName,
        creatorEmail: usersTable.email,
      })
      .from(quotesTable)
      .leftJoin(usersTable, eq(quotesTable.userId, usersTable.id))
      .orderBy(quotesTable.updatedAt);

    res.json({ quotes: rows });
  } catch (err) {
    console.error("GET /admin/quotes error:", err);
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

router.patch("/admin/quotes/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { fullName, userId: adminId } = req.auth!;
  const { meta, passStatus } = req.body as {
    meta: Record<string, unknown>;
    passStatus?: string | null;
  };

  try {
    const existing = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id))
      .limit(1);

    if (!existing.length) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    const existingData = existing[0].data as Record<string, unknown>;
    const existingMeta = (existingData.meta ?? {}) as Record<string, unknown>;
    const now = new Date();

    const newMeta = {
      ...existingMeta,
      ...meta,
      updatedAt: now.toISOString().split("T")[0],
      updatedByName: fullName,
    };

    const newData = { ...existingData, meta: newMeta };

    await db
      .update(quotesTable)
      .set({
        data: newData,
        quoteNumber: (newMeta.quoteNumber as string) ?? existing[0].quoteNumber,
        companyName: (newMeta.companyName as string) ?? existing[0].companyName,
        customerName: (newMeta.customerName as string) ?? existing[0].customerName,
        updatedAt: now,
        updatedByUserId: adminId,
        updatedByName: fullName,
        ...(passStatus !== undefined ? { passStatus: passStatus ?? null } : {}),
      })
      .where(eq(quotesTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/quotes/:id error:", err);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

router.delete("/admin/quotes/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(quotesTable).where(eq(quotesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/quotes/:id error:", err);
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

export default router;
