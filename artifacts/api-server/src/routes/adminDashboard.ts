import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

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

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalPipelineValue = 0;
    let totalMRR = 0;
    let quotesThisMonth = 0;
    let passCount = 0;
    let failCount = 0;

    const repMap = new Map<string, { quotes: number; value: number; pass: number }>();
    const customerMap = new Map<string, { value: number; sites: number }>();
    const monthlyMap = new Map<string, number>();
    const pitMap = new Map<string, number>();
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

      if (row.createdAt && row.createdAt >= thisMonthStart) quotesThisMonth++;

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
      },
      topReps,
      topCustomers,
      monthlyData,
      pitDistribution,
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
