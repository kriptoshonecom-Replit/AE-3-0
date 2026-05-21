import { Router } from "express";
import { db } from "@workspace/db";
import { amendmentsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

/* GET /api/amendments — list current user's amendments, optionally filtered */
router.get("/amendments", requireAuth, async (req, res) => {
  const { userId } = req.auth!;
  const { originalQuoteId } = req.query as { originalQuoteId?: string };
  try {
    const rows = originalQuoteId
      ? await db
          .select()
          .from(amendmentsTable)
          .where(and(eq(amendmentsTable.userId, userId), eq(amendmentsTable.originalQuoteId, originalQuoteId)))
          .orderBy(amendmentsTable.createdAt)
      : await db
          .select()
          .from(amendmentsTable)
          .where(eq(amendmentsTable.userId, userId))
          .orderBy(amendmentsTable.createdAt);
    res.json({ amendments: rows });
  } catch (err) {
    logger.error(err, "GET /amendments error");
    res.status(500).json({ error: "Failed to load amendments" });
  }
});

/* POST /api/amendments — create a new amendment */
router.post("/amendments", requireAuth, async (req, res) => {
  const { userId } = req.auth!;
  const body = req.body as {
    id?: string;
    originalQuoteId: string;
    originalQuoteNumber?: string;
    quoteNumber?: string;
    companyName?: string;
    customerName?: string;
    deltaGroups?: unknown;
    subtotalDelta?: number;
    mrrDelta?: number;
    discount?: number;
    tax?: number;
    notes?: string;
    addressNumber?: string;
    addressName?: string;
    addressCity?: string;
    addressState?: string;
    zipCode?: string;
    addressCountry?: string;
  };

  if (!body.originalQuoteId?.trim()) {
    res.status(400).json({ error: "originalQuoteId is required" });
    return;
  }

  try {
    const existing = await db
      .select({ amendmentNumber: amendmentsTable.amendmentNumber })
      .from(amendmentsTable)
      .where(and(eq(amendmentsTable.userId, userId), eq(amendmentsTable.originalQuoteId, body.originalQuoteId)));

    const nextNum = existing.length + 1;
    const now = new Date();
    const id = body.id ?? crypto.randomUUID();

    const data = {
      deltaGroups: body.deltaGroups ?? [],
      subtotalDelta: body.subtotalDelta ?? 0,
      mrrDelta: body.mrrDelta ?? 0,
      discount: body.discount ?? 0,
      tax: body.tax ?? 0,
      notes: body.notes ?? "",
      addressNumber: body.addressNumber ?? "",
      addressName: body.addressName ?? "",
      addressCity: body.addressCity ?? "",
      addressState: body.addressState ?? "",
      zipCode: body.zipCode ?? "",
      addressCountry: body.addressCountry ?? "",
    };

    const [row] = await db
      .insert(amendmentsTable)
      .values({
        id,
        originalQuoteId: body.originalQuoteId,
        userId,
        amendmentNumber: nextNum,
        quoteNumber: body.quoteNumber ?? "",
        originalQuoteNumber: body.originalQuoteNumber ?? "",
        companyName: body.companyName ?? "",
        customerName: body.customerName ?? "",
        data: data as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    logger.error(err, "POST /amendments error");
    res.status(500).json({ error: "Failed to create amendment" });
  }
});

/* PATCH /api/amendments/:id — update metadata */
router.patch("/amendments/:id", requireAuth, async (req, res) => {
  const { userId } = req.auth!;
  const id = String(req.params.id);
  const body = req.body as {
    quoteNumber?: string;
    notes?: string;
    deltaGroups?: unknown;
    subtotalDelta?: number;
    mrrDelta?: number;
    discount?: number;
    tax?: number;
    addressNumber?: string;
    addressName?: string;
    addressCity?: string;
    addressState?: string;
    zipCode?: string;
    addressCountry?: string;
  };

  try {
    const [existing] = await db
      .select()
      .from(amendmentsTable)
      .where(and(eq(amendmentsTable.id, id), eq(amendmentsTable.userId, userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Amendment not found" });
      return;
    }

    const existingData = (existing.data ?? {}) as Record<string, unknown>;
    const updatedData: Record<string, unknown> = {
      ...existingData,
      notes: body.notes ?? existingData["notes"] ?? "",
    };
    if (body.deltaGroups !== undefined) {
      updatedData["deltaGroups"] = body.deltaGroups;
      updatedData["subtotalDelta"] = body.subtotalDelta ?? existingData["subtotalDelta"] ?? 0;
      updatedData["mrrDelta"] = body.mrrDelta ?? existingData["mrrDelta"] ?? 0;
    }
    if (body.discount !== undefined) updatedData["discount"] = body.discount;
    if (body.tax !== undefined) updatedData["tax"] = body.tax;
    const addrFields = ["addressNumber", "addressName", "addressCity", "addressState", "zipCode", "addressCountry"] as const;
    for (const f of addrFields) {
      if (body[f] !== undefined) updatedData[f] = body[f];
    }

    const [updated] = await db
      .update(amendmentsTable)
      .set({
        quoteNumber: body.quoteNumber ?? existing.quoteNumber ?? "",
        data: updatedData,
        updatedAt: new Date(),
      })
      .where(and(eq(amendmentsTable.id, id), eq(amendmentsTable.userId, userId)))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error(err, "PATCH /amendments/:id error");
    res.status(500).json({ error: "Failed to update amendment" });
  }
});

/* DELETE /api/amendments/:id */
router.delete("/amendments/:id", requireAuth, async (req, res) => {
  const { userId } = req.auth!;
  const id = String(req.params.id);

  try {
    const deleted = await db
      .delete(amendmentsTable)
      .where(and(eq(amendmentsTable.id, id), eq(amendmentsTable.userId, userId)))
      .returning({ id: amendmentsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Amendment not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(err, "DELETE /amendments/:id error");
    res.status(500).json({ error: "Failed to delete amendment" });
  }
});

export default router;
