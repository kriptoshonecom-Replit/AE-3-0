import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable, statusPassConfigTable, customersTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const STATUS_PASS_CONFIG_ID = "default";
const DEFAULT_GATEWAY_COST = 0.005;

type SpTier  = { lowVolume: number; highVolume: number; txnRate: number };
type SpModel = { id: string; tiers: SpTier[] };
type SpCat   = { id: string; models: SpModel[] };

/**
 * Mirrors the QuoteBuilder frontend blended-rate logic exactly.
 * Uses the per-quote fixed rate override when enabled, otherwise
 * walks the StatusPass tier buckets to derive a blended $/txn rate.
 */
function computeGatewayRevMo(
  meta: Record<string, unknown>,
  cfgData: Record<string, unknown>,
): number {
  const annualStoreRev = parseFloat(String(meta.annualStoreRevenue ?? "").replace(/[^0-9.]/g, "")) || 0;
  const avgTicket      = parseFloat(String(meta.averageTicketAmount  ?? "").replace(/[^0-9.]/g, "")) || 0;
  if (annualStoreRev === 0 || avgTicket === 0) return 0;

  const txnCount  = annualStoreRev / avgTicket;           // annual transactions
  const numSites  = parseFloat(String(meta.numberOfSites ?? "").replace(/[^0-9.]/g, "")) || 0;
  const ncrPay    = meta.ncrPay === true;

  const yesEnabled = meta.voyixPayYesEnabled === true;
  const yesRate    = parseFloat(String(meta.voyixPayYesRate ?? "0").replace(/[^0-9.]/g, "")) || 0;
  const noEnabled  = meta.voyixPayNoEnabled === true;
  const noRate     = parseFloat(String(meta.voyixPayNoRate  ?? "0").replace(/[^0-9.]/g, "")) || 0;

  const useFixed = ncrPay ? (yesEnabled && yesRate > 0) : (noEnabled && noRate > 0);

  let blendedRate = 0;
  if (useFixed) {
    blendedRate = ncrPay ? yesRate : noRate;
  } else if (numSites > 0 && txnCount > 0) {
    const catId   = ncrPay ? "voyix-pay-yes" : "voyix-pay-no";
    const modelId = numSites < 10 ? "smb" : numSites <= 50 ? "mid-market" : "enterprise";
    const rawTxnCount      = (txnCount / 12) * numSites;
    const computedTxnCount = Math.round(rawTxnCount / 10) * 10;
    const spCats   = (cfgData.categories ?? []) as SpCat[];
    const spModel  = spCats.find((c) => c.id === catId)?.models.find((m) => m.id === modelId);
    if (spModel && computedTxnCount > 0) {
      let remaining = computedTxnCount, fees = 0;
      for (let i = 0; i < spModel.tiers.length; i++) {
        const t = spModel.tiers[i];
        const isLast  = t.highVolume === t.lowVolume;
        const prevHigh = i === 0 ? 0 : spModel.tiers[i - 1].highVolume;
        const cap  = isLast ? Infinity : i === 0 ? t.highVolume : t.highVolume - prevHigh;
        const used = Math.min(remaining, cap);
        fees += used * t.txnRate;
        remaining = Math.max(0, remaining - used);
        if (remaining === 0) break;
      }
      blendedRate = rawTxnCount > 0 ? fees / rawTxnCount : 0;
    }
  }

  return txnCount > 0 && blendedRate > 0 ? (txnCount * blendedRate) / 12 : 0;
}

const router = Router();

function parseDate(s: string | undefined | null): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Mirrors the frontend tiered pricing logic in quoteLogic.ts
const TIERED_ITEM_IDS = new Set(["co-001", "co-002"]);
const TIERED_ADDITIONAL_UNIT_PRICE = 30;

function computeLineItemTotal(productId: string, unitPrice: number, quantity: number): number {
  if (TIERED_ITEM_IDS.has(productId) && quantity > 0) {
    return unitPrice + Math.max(0, quantity - 1) * TIERED_ADDITIONAL_UNIT_PRICE;
  }
  return unitPrice * quantity;
}

function computeQuoteValues(data: Record<string, unknown>): { mrr: number; arr: number } {
  const meta = (data.meta ?? {}) as Record<string, unknown>;
  const groups = (data.groups ?? []) as Array<Record<string, unknown>>;
  const discount = Number(meta.discount ?? 0);
  const tax = Number(meta.tax ?? 0);

  // Primary: actual line-item total using the same tiered pricing as the frontend
  let subtotal = 0;
  for (const group of groups) {
    const lineItems = (group.lineItems ?? []) as Array<Record<string, unknown>>;
    for (const item of lineItems) {
      subtotal += computeLineItemTotal(
        String(item.productId ?? ""),
        Number(item.unitPrice ?? 0),
        Number(item.quantity ?? 0),
      );
    }
  }
  if (subtotal > 0) {
    const afterDiscount = subtotal * (1 - discount / 100);
    const mrr = afterDiscount * (1 + tax / 100);
    return { mrr, arr: mrr * 12 };
  }

  // Fallback: use requestedSubscriptionAmount if quote has no line items yet
  const reqSubRaw = String(meta.requestedSubscriptionAmount ?? "");
  const reqSub = parseFloat(reqSubRaw.replace(/[^0-9.]/g, ""));
  if (!isNaN(reqSub) && reqSub > 0) return { mrr: reqSub, arr: reqSub * 12 };

  return { mrr: 0, arr: 0 };
}

/* ── GET /api/quotes/stats — per-user summary stats ── */
router.get("/quotes/stats", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { userId } = req.auth!;
  try {
    const [rows, configRows] = await Promise.all([
      db
        .select({ data: quotesTable.data, passStatus: quotesTable.passStatus })
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId)),
      db
        .select({ data: statusPassConfigTable.data })
        .from(statusPassConfigTable)
        .where(eq(statusPassConfigTable.id, STATUS_PASS_CONFIG_ID))
        .limit(1),
    ]);

    const cfgData = (configRows[0]?.data ?? {}) as Record<string, unknown>;
    const gatewayCost = typeof cfgData.gatewayCost === "number" ? cfgData.gatewayCost : DEFAULT_GATEWAY_COST;

    let passCount = 0;
    let failCount = 0;
    let passMrr = 0;
    let passArr = 0;
    let totalMrr = 0;
    let totalArr = 0;
    let passRequestedMonthly = 0;
    let failRequestedMonthly = 0;
    let passRequestedUpfront = 0;
    let failRequestedUpfront = 0;
    let passPaymentsRevMo = 0;
    let passGatewayRevMo = 0;
    let totalPaymentsRevMo = 0;
    let totalGatewayRevMo = 0;
    let passTotalSites = 0;
    let allTotalSites = 0;

    for (const row of rows) {
      const data = row.data as Record<string, unknown>;
      const meta = (data.meta ?? {}) as Record<string, unknown>;
      const { mrr, arr } = computeQuoteValues(data);
      totalMrr += mrr;
      totalArr += arr;
      const status = (row.passStatus ?? (meta.passStatus as string | undefined) ?? "").toLowerCase();
      const reqMonthly = parseFloat(String(meta.requestedSubscriptionAmount ?? "").replace(/[^0-9.]/g, "")) || 0;
      const reqUpfront = parseFloat(String(meta.requestedUpfrontAmount ?? "").replace(/[^0-9.]/g, "")) || 0;

      const annualStoreRev = parseFloat(String(meta.annualStoreRevenue ?? "").replace(/[^0-9.]/g, "")) || 0;
      const sites = Math.max(parseInt(String(meta.numberOfSites ?? "1"), 10) || 1, 1);
      const basisPts = parseFloat(String(meta.basisPoint ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const monthlyVol = annualStoreRev / 12;
      const paymentsRevMo = (basisPts / 10000) * monthlyVol;
      const gatewayRevMo = computeGatewayRevMo(meta, cfgData);

      if (annualStoreRev > 0) {
        totalPaymentsRevMo += paymentsRevMo;
        totalGatewayRevMo += gatewayRevMo;
        allTotalSites += sites;
      }

      if (status === "pass") {
        passCount++; passMrr += mrr; passArr += arr;
        passRequestedMonthly += reqMonthly;
        passRequestedUpfront += reqUpfront;
        if (annualStoreRev > 0) {
          passPaymentsRevMo += paymentsRevMo;
          passGatewayRevMo += gatewayRevMo;
          passTotalSites += sites;
        }
      } else if (status === "fail") {
        failCount++;
        failRequestedMonthly += reqMonthly;
        failRequestedUpfront += reqUpfront;
      }
    }

    const total = rows.length;
    const successRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
    res.json({
      total, passCount, failCount, passMrr, passArr, totalMrr, totalArr, successRate,
      passRequestedMonthly, failRequestedMonthly, passRequestedUpfront, failRequestedUpfront,
      passPaymentsRevMo, passGatewayRevMo, totalPaymentsRevMo, totalGatewayRevMo,
      passTotalSites, allTotalSites,
    });
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

    // Exclude phantom blank quotes — rows with no identifying header fields
    // AND no line items. These are auto-created drafts that were never saved
    // by the user and should not appear in the sidebar.
    const visible = rows.filter((r) => {
      const hasHeader = r.quoteNumber || r.companyName || r.customerName;
      if (hasHeader) return true;
      const data = r.data as Record<string, unknown>;
      const groups = (data?.groups as unknown[]) ?? [];
      return groups.length > 0;
    });

    res.json({ quotes: visible.map((r) => r.data) });
  } catch (err) {
    req.log.error(err, "GET /quotes error");
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

/* ── GET /api/quotes/:id — fetch a single quote by its meta.id ── */
/* Must be AFTER /quotes/library to avoid matching "library" as an id */
router.get("/quotes/:id", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const id = String(req.params.id);
  try {
    const rows = await db
      .select()
      .from(quotesTable)
      .where(and(eq(quotesTable.id, id), eq(quotesTable.userId, userId)))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }
    res.json({ quote: rows[0].data });
  } catch (err) {
    req.log.error(err, "GET /quotes/:id error");
    res.status(500).json({ error: "Failed to load quote" });
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

    // Upsert customer record so it persists independently of quotes
    const mcn = String(meta.mcn ?? "").trim();
    const email = String(meta.customerEmail ?? "").trim().toLowerCase();
    const cKey = mcn || email || `${String(meta.companyName ?? "").trim()}___${String(meta.customerName ?? "").trim()}`;
    const hasIdentifyingInfo = !!(String(meta.companyName ?? "").trim() || String(meta.customerName ?? "").trim() || email);
    if (cKey && cKey !== "___" && hasIdentifyingInfo) {
      const addrLine = String(meta.addressLine ?? "");
      const addrCity = String(meta.addressCity ?? "");
      const addrName = String(meta.addressName ?? "");
      const address = (addrLine || addrCity || addrName) ? {
        line: addrLine,
        name: addrName,
        number: String(meta.addressNumber ?? ""),
        city: addrCity,
        state: String(meta.addressState ?? ""),
        zip: String(meta.zipCode ?? ""),
        country: String(meta.addressCountry ?? ""),
      } : null;
      const billingLine = String(meta.billingAddressLine ?? "");
      const billingCity = String(meta.billingAddressCity ?? "");
      const sameForBilling = meta.sameForBilling;
      const billingAddress = (!sameForBilling && (billingLine || billingCity)) ? {
        line: billingLine,
        name: String(meta.billingAddressName ?? ""),
        number: String(meta.billingAddressNumber ?? ""),
        city: billingCity,
        state: String(meta.billingAddressState ?? ""),
        zip: String(meta.billingZipCode ?? ""),
        country: String(meta.billingAddressCountry ?? ""),
      } : null;

      const companyName = String(meta.companyName ?? "") || null;
      const customerName = String(meta.customerName ?? "") || null;
      const customerPhone = String(meta.customerPhone ?? "") || null;
      const mcn = String(meta.mcn ?? "") || null;

      await db
        .insert(customersTable)
        .values({
          id: cKey,
          companyName,
          customerName,
          customerEmail: email || null,
          customerPhone,
          mcn,
          address,
          billingAddress,
          creatorUserId: userId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: customersTable.id,
          set: {
            ...(companyName && { companyName }),
            ...(customerName && { customerName }),
            ...(email && { customerEmail: email }),
            ...(customerPhone && { customerPhone }),
            ...(mcn && { mcn }),
            ...(address && { address }),
            ...(billingAddress && { billingAddress }),
            updatedAt: new Date(),
          },
        });
    }

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
