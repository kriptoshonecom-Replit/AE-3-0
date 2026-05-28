import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable, usersTable, amendmentsTable, statusPassConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

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

  const txnCount  = annualStoreRev / avgTicket;
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
        const isLast   = t.highVolume === t.lowVolume;
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

/**
 * Parse state and country from a freeform address line.
 * Handles typical formats like:
 *   "123 Main St, Atlanta, GA 30301, United States"
 *   "123 Main St, Atlanta, GA 30301"
 *   "Atlanta, GA"
 */
function parseLocationFromAddressLine(line: string): { state: string; country: string } {
  if (!line) return { state: "", country: "" };
  const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
  let state = "";
  let country = "";

  // Last part is often the country (non-numeric, length > 2)
  const lastPart = parts[parts.length - 1] ?? "";
  if (lastPart && !/^\d/.test(lastPart) && lastPart.length > 2 && parts.length >= 3) {
    country = lastPart;
  }

  // Find "STATE" or "STATE ZIPCODE" pattern — 2 uppercase letters optionally followed by digits
  for (const part of parts) {
    const match = part.match(/^([A-Z]{2})(?:\s+\d{4,5}(?:-\d{4})?)?$/);
    if (match) { state = match[1]; break; }
  }

  return { state, country };
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

function computeQuoteTotal(data: Record<string, unknown>): number {
  return computeQuoteValues(data).arr;
}

router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  try {
    const [rows, configRows, amendRows] = await Promise.all([
      db
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
        .orderBy(quotesTable.updatedAt),
      db
        .select({ data: statusPassConfigTable.data })
        .from(statusPassConfigTable)
        .where(eq(statusPassConfigTable.id, STATUS_PASS_CONFIG_ID))
        .limit(1),
      db
        .select({ createdAt: amendmentsTable.createdAt })
        .from(amendmentsTable),
    ]);

    const cfgData = (configRows[0]?.data ?? {}) as Record<string, unknown>;
    const gatewayCost = typeof cfgData.gatewayCost === "number" ? cfgData.gatewayCost : DEFAULT_GATEWAY_COST;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalAmendments = amendRows.length;
    const amendmentsThisMonth = amendRows.filter(r => r.createdAt && r.createdAt >= thisMonthStart).length;

    let totalPipelineValue = 0;
    let totalMRR = 0;
    let quotesThisMonth = 0;
    let passCount = 0;
    let failCount = 0;
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

    const repMap = new Map<string, { quotes: number; value: number; pass: number }>();
    const customerMap = new Map<string, { value: number; sites: number }>();
    const monthlyMap = new Map<string, number>();
    const pitMap = new Map<string, number>();
    type GeoEntry = { quoteCount: number; totalArr: number; passCount: number; failCount: number };
    const stateMap = new Map<string, GeoEntry>();
    const countryMap = new Map<string, GeoEntry>();
    const recentActivity: Array<{ action: string; rep: string; time: Date; dot: string }> = [];

    for (const row of rows) {
      const data = row.data as Record<string, unknown>;
      const meta = (data.meta ?? {}) as Record<string, unknown>;
      const { mrr, arr } = computeQuoteValues(data);
      const quoteValue = arr;
      totalPipelineValue += arr;
      totalMRR += mrr;

      const normalizedStatus =
        row.passStatus ??
        (meta.passStatus as string | undefined) ??
        null;

      if (normalizedStatus?.toLowerCase() === "pass") passCount++;
      else if (normalizedStatus?.toLowerCase() === "fail") failCount++;

      const reqMonthly = parseFloat(String(meta.requestedSubscriptionAmount ?? "").replace(/[^0-9.]/g, "")) || 0;
      const reqUpfront = parseFloat(String(meta.requestedUpfrontAmount ?? "").replace(/[^0-9.]/g, "")) || 0;
      if (normalizedStatus?.toLowerCase() === "pass") {
        passRequestedMonthly += reqMonthly;
        passRequestedUpfront += reqUpfront;
      } else if (normalizedStatus?.toLowerCase() === "fail") {
        failRequestedMonthly += reqMonthly;
        failRequestedUpfront += reqUpfront;
      }

      if (row.createdAt && row.createdAt >= thisMonthStart) quotesThisMonth++;

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
        if (normalizedStatus?.toLowerCase() === "pass") {
          passPaymentsRevMo += paymentsRevMo;
          passGatewayRevMo += gatewayRevMo;
          passTotalSites += sites;
        }
      }

      const repName = (meta.salesRep as string) || row.creatorName || "Unknown";
      const repEntry = repMap.get(repName) ?? { quotes: 0, value: 0, pass: 0 };
      repEntry.quotes++;
      repEntry.value += quoteValue;
      if (normalizedStatus?.toLowerCase() === "pass") repEntry.pass++;
      repMap.set(repName, repEntry);

      const company = row.companyName || (meta.companyName as string) || "Unknown";
      const custEntry = customerMap.get(company) ?? { value: 0, sites: 0 };
      custEntry.value += quoteValue;
      custEntry.sites++;
      customerMap.set(company, custEntry);

      if (row.createdAt) {
        const monthKey = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + quoteValue);
      }

      const pitType = (meta.pitType as string) || "None";
      pitMap.set(pitType, (pitMap.get(pitType) ?? 0) + 1);

      const isPass = normalizedStatus?.toLowerCase() === "pass";
      const isFail = normalizedStatus?.toLowerCase() === "fail";

      // Use individual fields first; fall back to parsing the freeform addressLine
      const addrLineFallback = String(meta.addressLine ?? "").trim();
      const parsed = parseLocationFromAddressLine(addrLineFallback);

      const stateRaw = String(meta.addressState ?? "").trim() || parsed.state;
      if (stateRaw) {
        const e = stateMap.get(stateRaw) ?? { quoteCount: 0, totalArr: 0, passCount: 0, failCount: 0 };
        e.quoteCount++; e.totalArr += arr;
        if (isPass) e.passCount++; else if (isFail) e.failCount++;
        stateMap.set(stateRaw, e);
      }

      const countryRaw = String(meta.addressCountry ?? "").trim() || parsed.country;
      if (countryRaw) {
        const e = countryMap.get(countryRaw) ?? { quoteCount: 0, totalArr: 0, passCount: 0, failCount: 0 };
        e.quoteCount++; e.totalArr += arr;
        if (isPass) e.passCount++; else if (isFail) e.failCount++;
        countryMap.set(countryRaw, e);
      }

      const actor = row.updatedByName || row.creatorName || "Unknown";
      const updatedAt = row.updatedAt ?? row.createdAt ?? now;
      if (normalizedStatus?.toLowerCase() === "pass") {
        recentActivity.push({ action: `${row.quoteNumber || row.id} marked PASS`, rep: actor, time: updatedAt, dot: "#22c55e" });
      } else if (normalizedStatus?.toLowerCase() === "fail") {
        recentActivity.push({ action: `${row.quoteNumber || row.id} marked FAIL`, rep: actor, time: updatedAt, dot: "#ef4444" });
      } else {
        recentActivity.push({ action: `${row.quoteNumber || row.id} updated`, rep: actor, time: updatedAt, dot: "#7c3aed" });
      }
    }

    const totalQuotes = rows.length;
    const passRate = totalQuotes > 0 ? Math.round((passCount / totalQuotes) * 100) : 0;
    const avgQuoteValue = totalQuotes > 0 ? totalPipelineValue / totalQuotes : 0;

    const topReps = Array.from(repMap.entries())
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topCustomers = Array.from(customerMap.entries())
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyData: Array<{ month: string; value: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short" });
      monthlyData.push({ month: label, value: monthlyMap.get(key) ?? 0 });
    }
    void sixMonthsAgo;

    const pitDistribution = Array.from(pitMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const sortedActivity = recentActivity
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 8)
      .map((a) => ({
        action: a.action,
        rep: a.rep,
        dot: a.dot,
        time: a.time.toISOString(),
      }));

    res.json({
      kpis: {
        totalPipelineValue,
        totalMRR,
        totalQuotes,
        quotesThisMonth,
        passRate,
        passCount,
        failCount,
        avgQuoteValue,
        passRequestedMonthly,
        failRequestedMonthly,
        passRequestedUpfront,
        failRequestedUpfront,
        passPaymentsRevMo,
        passGatewayRevMo,
        totalPaymentsRevMo,
        totalGatewayRevMo,
        passTotalSites,
        allTotalSites,
      },
      amendments: { total: totalAmendments, thisMonth: amendmentsThisMonth },
      topReps,
      topCustomers,
      monthlyData,
      pitDistribution,
      geoDistribution: {
        byState: Array.from(stateMap.entries()).map(([location, e]) => ({ location, ...e })),
        byCountry: Array.from(countryMap.entries()).map(([location, e]) => ({ location, ...e })),
      },
      recentActivity: sortedActivity,
      recentQuotes: rows
        .slice(-10)
        .reverse()
        .map((r) => {
          const data = r.data as Record<string, unknown>;
          const meta = (data.meta ?? {}) as Record<string, unknown>;
          return {
            id: r.id,
            quoteNumber: r.quoteNumber ?? (meta.quoteNumber as string) ?? r.id,
            companyName: r.companyName ?? (meta.companyName as string) ?? "—",
            customerName: r.customerName ?? (meta.customerName as string) ?? "—",
            salesRep: (meta.salesRep as string) || r.creatorName || "—",
            value: computeQuoteTotal(data),
            passStatus:
              r.passStatus ??
              (meta.passStatus as string | undefined) ??
              null,
            updatedAt: (r.updatedAt ?? r.createdAt ?? new Date()).toISOString(),
            addressLine: (meta.addressLine as string) ?? null,
            addressCity: (meta.addressCity as string) ?? null,
            addressState: (meta.addressState as string) ?? null,
            addressCountry: (meta.addressCountry as string) ?? null,
          };
        }),
    });
  } catch (err) {
    console.error("GET /admin/dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

export default router;
