import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function parseDate(s: string | undefined | null): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function computeQuoteTotal(data: Record<string, unknown>): number {
  const meta = (data.meta ?? {}) as Record<string, unknown>;

  // Primary: use "Requested Subscription Amount" if entered and non-zero
  const reqSubRaw = String(meta.requestedSubscriptionAmount ?? "");
  const reqSub = parseFloat(reqSubRaw.replace(/[^0-9.]/g, ""));
  if (!isNaN(reqSub) && reqSub > 0) return reqSub;

  // Fallback: calculate from line items with discount and tax
  const groups = (data.groups ?? []) as Array<Record<string, unknown>>;
  const discount = Number(meta.discount ?? 0);
  const tax = Number(meta.tax ?? 0);
  let subtotal = 0;
  for (const group of groups) {
    const lineItems = (group.lineItems ?? []) as Array<Record<string, unknown>>;
    for (const item of lineItems) {
      subtotal += Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
    }
  }
  const afterDiscount = subtotal * (1 - discount / 100);
  return afterDiscount * (1 + tax / 100);
}

/* ── GET /api/quotes/stats — per-user summary stats ── */
router.get("/quotes/stats", requireAuth, async (req, res) => {
  const { userId } = req.auth!;
  try {
    const rows = await db
      .select({ data: quotesTable.data, passStatus: quotesTable.passStatus })
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId));

    let passCount = 0;
    let failCount = 0;
    let passValue = 0;
    let totalValue = 0;

    for (const row of rows) {
      const data = row.data as Record<string, unknown>;
      const meta = (data.meta ?? {}) as Record<string, unknown>;
      const value = computeQuoteTotal(data);
      totalValue += value;
      const status = (row.passStatus ?? (meta.passStatus as string | undefined) ?? "").toLowerCase();
      if (status === "pass") { passCount++; passValue += value; }
      else if (status === "fail") failCount++;
    }

    const total = rows.length;
    const successRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
    res.json({ total, passCount, failCount, passValue, totalValue, successRate });
  } catch (err) {
    req.log.error(err, "GET /quotes/stats error");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/quotes", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  try {
    const rows = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId));
    res.json({ quotes: rows.map((r) => r.data) });
  } catch (err) {
    console.error("GET /quotes error:", err);
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

/* ── GET /api/quotes/library — enriched list for the current user ── */
router.get("/quotes/library", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
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
      })
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId))
      .orderBy(quotesTable.updatedAt);

    const normalised = rows.map((r) => ({
      ...r,
      passStatus:
        r.passStatus ??
        ((r.data as Record<string, unknown>)?.meta as Record<string, unknown> | undefined)
          ?.passStatus as string | null ?? null,
    }));
    res.json({ quotes: normalised });
  } catch (err) {
    console.error("GET /quotes/library error:", err);
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

router.post("/quotes/sync", requireAuth, async (req, res) => {
  const { userId, fullName } = req.auth!;
  const { quote } = req.body as { quote: { meta: Record<string, string | number | boolean | undefined | null> } };

  if (!quote?.meta?.id) {
    res.status(400).json({ error: "Invalid quote: missing meta.id" });
    return;
  }

  const meta = quote.meta;
  const quoteData = {
    ...quote,
    meta: {
      ...meta,
      creatorName: (meta.creatorName as string | undefined) || fullName,
    },
  };

  try {
    await db
      .insert(quotesTable)
      .values({
        id: String(meta.id),
        userId,
        data: quoteData,
        quoteNumber: (meta.quoteNumber as string) || null,
        companyName: (meta.companyName as string) || null,
        customerName: (meta.customerName as string) || null,
        passStatus: (meta.passStatus as string) || null,
        createdAt: parseDate(meta.createdAt as string),
        updatedAt: parseDate(meta.updatedAt as string),
      })
      .onConflictDoUpdate({
        target: quotesTable.id,
        set: {
          data: quoteData,
          quoteNumber: (meta.quoteNumber as string) || null,
          companyName: (meta.companyName as string) || null,
          customerName: (meta.customerName as string) || null,
          updatedAt: parseDate(meta.updatedAt as string),
          updatedByName: fullName,
          passStatus: (meta.passStatus as string) || null,
        },
      });

    res.json({ ok: true, creatorName: (quoteData.meta as Record<string, unknown>).creatorName });
  } catch (err) {
    console.error("POST /quotes/sync error:", err);
    res.status(500).json({ error: "Failed to sync quote" });
  }
});

/* ── PATCH /api/quotes/:id — user edits their own quote metadata ── */
router.patch("/quotes/:id", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { fullName } = req.auth!;
  const id = String(req.params.id);
  const { meta, passStatus } = req.body as {
    meta: Record<string, unknown>;
    passStatus?: string | null;
  };

  try {
    const existing = await db
      .select()
      .from(quotesTable)
      .where(and(eq(quotesTable.id, id), eq(quotesTable.userId, userId)))
      .limit(1);

    if (!existing.length) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    const existingData = existing[0].data as Record<string, unknown>;
    const existingMeta = (existingData.meta ?? {}) as Record<string, unknown>;
    const now = new Date();

    const newMeta: Record<string, unknown> = {
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
        quoteNumber: (newMeta.quoteNumber as string) || null,
        companyName: (newMeta.companyName as string) || null,
        customerName: (newMeta.customerName as string) || null,
        updatedAt: now,
        updatedByName: fullName,
        ...(passStatus !== undefined ? { passStatus: passStatus ?? null } : {}),
      })
      .where(and(eq(quotesTable.id, id), eq(quotesTable.userId, userId)));

    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /quotes/:id error:", err);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

/* ── POST /api/quotes/:id/duplicate — create a copy for the same user ── */
router.post("/quotes/:id/duplicate", requireAuth, async (req, res) => {
  const { userId } = req.auth!;
  const id = String(req.params.id);
  try {
    const existing = await db
      .select()
      .from(quotesTable)
      .where(and(eq(quotesTable.id, id), eq(quotesTable.userId, userId)))
      .limit(1);

    if (!existing.length) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    const original = existing[0].data as Record<string, unknown>;
    const originalMeta = ((original.meta ?? {}) as Record<string, unknown>);
    const now = new Date();
    const newId = Math.random().toString(36).slice(2, 10);
    const today = now.toISOString().split("T")[0];
    const origNumber = (originalMeta.quoteNumber as string | undefined) ?? "";

    const newMeta: Record<string, unknown> = {
      ...originalMeta,
      id: newId,
      quoteNumber: origNumber ? `Copy of ${origNumber}` : "Copy",
      createdAt: today,
      updatedAt: today,
      passStatus: null,
      updatedByName: null,
      updatedByUserId: null,
    };

    const newData = { ...original, meta: newMeta };

    await db.insert(quotesTable).values({
      id: newId,
      userId,
      data: newData,
      quoteNumber: (newMeta.quoteNumber as string) || null,
      companyName: (newMeta.companyName as string) || null,
      customerName: (newMeta.customerName as string) || null,
      passStatus: null,
      createdAt: now,
      updatedAt: now,
    });

    res.json({ ok: true, id: newId, quote: newData });
  } catch (err) {
    req.log.error(err, "POST /quotes/:id/duplicate error");
    res.status(500).json({ error: "Failed to duplicate quote" });
  }
});

router.delete("/quotes/:id", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const id = String(req.params.id);
  try {
    await db
      .delete(quotesTable)
      .where(and(eq(quotesTable.id, id), eq(quotesTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /quotes/:id error:", err);
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

export default router;
