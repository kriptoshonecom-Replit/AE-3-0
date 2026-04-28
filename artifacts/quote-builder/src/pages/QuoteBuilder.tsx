import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import logo from "/logo.png";
import type { Quote, QuoteGroup, QuoteLineItem, QuoteMeta, ProductCategory, PitCategory } from "../types";
import catalog from "../data/products.json";
import pitDataStatic from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";
import QuoteMetaForm from "../components/QuoteMetaForm";
import CurrentSpendForm from "../components/CurrentSpendForm";
import HeatmapSection, { computeHeatmapTotal, type HeatmapItem } from "../components/HeatmapSection";
import PaymentsConfigPanel from "../components/PaymentsConfigPanel";

import UnsavedChangesModal from "../components/UnsavedChangesModal";
import LicenseSyncModal from "../components/LicenseSyncModal";
import {
  lookupQtyChanged,
  lookupProductSelected,
  subjectProductSelected,
  subjectQtyChanged,
  computeLookupCount,
  findSubjectItem,
} from "../utils/licenseSync";
import PitSection from "../components/PitSection";
import ProductRelatedPitSection, { computeProductRelatedPitTotal, buildProductCatalogMap, type ProductCatalogMap } from "../components/ProductRelatedPitSection";
import QuoteGroupComponent from "../components/QuoteGroup";
import QuoteSummary from "../components/QuoteSummary";
import QuoteList from "../components/QuoteList";
import AddGroupModal from "../components/AddGroupModal";
import { saveQuote, loadAllQuotes, getActiveQuoteId, loadQuote } from "../utils/storage";
import { syncQuoteToServer, fetchServerQuotes } from "../utils/serverSync";
import { exportQuoteToPDF } from "../utils/pdfExport";
import { generateId, todayString, thirtyDaysOut, quoteTotal } from "../utils/calculations";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const DEFAULT_YES_NO: Record<string, boolean> = {
  "connected-payments-yn": false,
  "online-ordering-yn": false,
};

const DEFAULT_OPT_PROGRAMS: Record<string, boolean> = {
  "consumer-marketing": true,
  "insight-or-console": true,
  "aloha-api": true,
  "kitchen": true,
  "orderpay": true,
  "aloha-delivery": true,
};

const DEFAULT_HEATMAP_TOGGLES: Record<string, boolean> = {
  "heat-001": false,
  "heat-002": false,
  "heat-003": false,
};

function createNewQuote(): Quote {
  return {
    meta: {
      id: generateId(),
      quoteNumber: "",
      oppNumber: "",
      salesRep: "",
      companyName: "",
      customerName: "",
      customerEmail: "",
      validUntil: thirtyDaysOut(),
      notes: "",
      createdAt: todayString(),
      updatedAt: todayString(),
      discount: 0,
      tax: 0,
      pitType: "",
    },
    groups: [],
  };
}

// ── Auto-add helper for info-only alerts ──────────────────────────────────────
// For each lookup product not already present in the quote (qty > 0), adds a
// new line item with quantity 1 into the matching category group (or a new group).
function autoAddLookupProducts(
  groups: QuoteGroup[],
  lookupIds: string[],
  categories: ProductCategory[],
): QuoteGroup[] {
  const missing = lookupIds.filter((lid) => {
    const total = groups.reduce(
      (sum, g) => sum + g.lineItems.filter((li) => li.productId === lid).reduce((s, li) => s + li.quantity, 0),
      0,
    );
    return total === 0;
  });
  if (missing.length === 0) return groups;

  let nextGroups = [...groups];
  for (const pid of missing) {
    let foundItem: { id: string; name: string; price: number } | undefined;
    let foundCatId = "";
    let foundCatName = "";
    outer: for (const cat of categories) {
      for (const item of cat.items) {
        if (item.id === pid) {
          foundItem = item;
          foundCatId = cat.id;
          foundCatName = cat.name;
          break outer;
        }
      }
    }
    if (!foundItem) continue;

    const newLineItem: QuoteLineItem = {
      id: generateId(),
      productId: foundItem.id,
      productName: foundItem.name,
      unitPrice: foundItem.price,
      quantity: 1,
    };

    const groupIdx = nextGroups.findIndex((g) => g.categoryId === foundCatId);
    if (groupIdx >= 0) {
      nextGroups = nextGroups.map((g, i) =>
        i === groupIdx ? { ...g, lineItems: [...g.lineItems, newLineItem] } : g,
      );
    } else {
      nextGroups = [
        ...nextGroups,
        {
          id: generateId(),
          categoryId: foundCatId,
          categoryName: foundCatName,
          lineItems: [newLineItem],
          isOpen: true,
        },
      ];
    }
  }
  return nextGroups;
}

export default function QuoteBuilder() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [, setLocation] = useLocation();

  const [quote, setQuote] = useState<Quote>(createNewQuote);
  const [initialized, setInitialized] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [yesNoToggles, setYesNoToggles] = useState<Record<string, boolean>>(DEFAULT_YES_NO);
  const [optionalProgramToggles, setOptionalProgramToggles] = useState<Record<string, boolean>>(DEFAULT_OPT_PROGRAMS);
  const [heatmapToggles, setHeatmapToggles] = useState<Record<string, boolean>>(DEFAULT_HEATMAP_TOGGLES);
  const isDirtyRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<null | "export" | "new">(null);

  const [productCategories, setProductCategories] = useState<ProductCategory[]>(
    catalog.categories as unknown as ProductCategory[],
  );

  const catalogMap: ProductCatalogMap = useMemo(
    () => buildProductCatalogMap(productCategories),
    [productCategories],
  );

  const [pitCategories, setPitCategories] = useState<PitCategory[]>(
    (pitDataStatic.categories as unknown as PitCategory[]).filter((c) => c.id !== "heatmap"),
  );

  const [pitHourlyRate, setPitHourlyRate] = useState<number>(PIT_HOURLY_RATE);

  const [heatmapItems, setHeatmapItems] = useState<HeatmapItem[]>(() => {
    const cat = (pitDataStatic.categories as Array<{ id: string; lineItems: Array<{ id: string; name: string; price?: number }> }>).find(
      (c) => c.id === "heatmap",
    );
    return cat ? (cat.lineItems.filter((i) => i.price !== undefined) as HeatmapItem[]) : [];
  });

  // ── Status Pass stamp ──────────────────────────────────────
  const [spData, setSpData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/status-pass`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSpData(d))
      .catch(() => {});
  }, []);

  const stampStatus = useMemo((): "pass" | "fail" | null => {
    const pDollar = (s: string | undefined) =>
      parseFloat((s ?? "").replace(/[^0-9.-]/g, "")) || 0;
    const meta = quote.meta;

    // ── Compute productPciSum & hwmCostMonthly from live groups ──
    const TIER_IDS = new Set(["co-001", "co-002"]);
    const TIER_EXTRA = 6.30;
    let productPciSum = 0;
    let hwmCostMonthly = 0;
    const attrMap = new Map<string, { pci: number; hwmc: number }>();
    for (const cat of productCategories) {
      for (const item of cat.items) {
        const a = item as unknown as { pci?: number; hwmc?: number };
        attrMap.set(item.id, { pci: a.pci ?? 0, hwmc: a.hwmc ?? 0 });
      }
    }
    for (const group of quote.groups) {
      for (const li of group.lineItems) {
        const attrs = attrMap.get(li.productId);
        if (!attrs) continue;
        const qty = li.quantity;
        if (attrs.pci > 0 && qty > 0) {
          productPciSum += TIER_IDS.has(li.productId) && qty > 1
            ? attrs.pci + (qty - 1) * TIER_EXTRA
            : attrs.pci * qty;
        }
        if (attrs.hwmc > 0 && qty > 0) hwmCostMonthly += attrs.hwmc * qty;
      }
    }

    const pitCat = pitCategories.find((c) => c.id === (meta.pitType ?? ""));
    const pitTotal = pitCat
      ? pitCat.lineItems.reduce((s, i) => s + i.duration * pitHourlyRate, 0) : 0;
    const productPitTotal = computeProductRelatedPitTotal(
      quote.groups, yesNoToggles, optionalProgramToggles,
      meta.pitType ?? "", catalogMap, pitHourlyRate,
    );
    const heatmapTotal = computeHeatmapTotal(
      heatmapToggles, heatmapItems.length > 0 ? heatmapItems : undefined,
    );

    // ── Revenue ──
    const annualRevenue  = pDollar(meta.annualStoreRevenue);
    const avgTicket      = pDollar(meta.averageTicketAmount);
    const txnCount       = avgTicket > 0 ? annualRevenue / avgTicket : 0;
    const bpDecimal      = (parseFloat(meta.basisPoint ?? "") || 0) / 10000;
    const voyixFee       = parseFloat(meta.voyixPayTransactionFee ?? "") || 0;
    const subM1          = pDollar(meta.requestedSubscriptionAmount);
    const upfrontM1      = pDollar(meta.requestedUpfrontAmount);
    const paymentsRevM1  = annualRevenue > 0 || txnCount > 0
      ? ((bpDecimal * annualRevenue) + (voyixFee * txnCount)) / 12 : 0;

    // ── Gateway revenue: blended rate from StatusPass tier tables ──
    const numSitesVal      = parseFloat(meta.numberOfSites ?? "") || 0;
    const catId            = meta.ncrPay ? "voyix-pay-yes" : "voyix-pay-no";
    const modelId          =
      numSitesVal > 0 && numSitesVal < 10 ? "smb"
      : numSitesVal >= 10 && numSitesVal <= 50 ? "mid-market"
      : numSitesVal > 50 ? "enterprise" : "";
    const rawTxnCount      = txnCount > 0 && numSitesVal > 0 ? (txnCount / 12) * numSitesVal : 0;
    const computedTxnCount = rawTxnCount > 0 ? Math.round(rawTxnCount / 10) * 10 : 0;
    type SpTier   = { lowVolume: number; highVolume: number; txnRate: number };
    type SpModel  = { id: string; tiers: SpTier[] };
    type SpCat    = { id: string; models: SpModel[] };
    const spCats  = (spData?.categories ?? []) as SpCat[];
    const spModel = spCats.find((c) => c.id === catId)?.models.find((m) => m.id === modelId);
    const blendedRate = (() => {
      if (!spModel || computedTxnCount === 0 || rawTxnCount === 0) return 0;
      let remaining = computedTxnCount, fees = 0;
      for (let idx = 0; idx < spModel.tiers.length; idx++) {
        const t = spModel.tiers[idx];
        const isLast = t.highVolume === t.lowVolume;
        const prevHigh = idx === 0 ? 0 : spModel.tiers[idx - 1].highVolume;
        const cap = isLast ? Infinity : idx === 0 ? t.highVolume : t.highVolume - prevHigh;
        const used = Math.min(remaining, cap);
        fees += used * t.txnRate;
        remaining = Math.max(0, remaining - used);
        if (remaining === 0) break;
      }
      return rawTxnCount > 0 ? fees / rawTxnCount : 0;
    })();
    const gatewayRevM1 = txnCount > 0 && blendedRate > 0 ? (txnCount * blendedRate) / 12 : 0;

    const revM1         = subM1 + upfrontM1 + paymentsRevM1 + gatewayRevM1;
    const revY1         = (subM1 * 12) + upfrontM1 + (paymentsRevM1 * 12) + (gatewayRevM1 * 12);
    const revY2         = (subM1 * 12) + (paymentsRevM1 * 12) + (gatewayRevM1 * 12);
    const revGrandTotal = revY1 + revY2 + revY2;

    const priorMonthly = pDollar(meta.aeCurrentMonthlySpend) + pDollar(meta.aeCurrentVoyixPaySpend);
    const hasData = revM1 > 0 || priorMonthly > 0;
    if (!hasData) return null;

    // ── Cost ──
    const costBuffer     = ((spData?.costBuffer as number) ?? 12) / 100;
    const gatewayCost    = (spData?.gatewayCost    as number) ?? 0.005;
    const processingCost = (spData?.processingCost as number) ?? 0.0125;

    const swHwM1     = productPciSum * (1 + costBuffer);
    const paysCostM1 = txnCount > 0
      ? (txnCount * (gatewayCost + ((meta.ncrPay ?? false) ? processingCost : 0))) / 12 : 0;

    let instY1: number, instY2: number;
    if (meta.recurringPit) {
      const pitMo = (((pitTotal + productPitTotal) / 120) * 4) / 2;
      instY1 = pitMo * 12 + heatmapTotal / 2; instY2 = pitMo * 12;
    } else {
      instY1 = (pitTotal + productPitTotal + heatmapTotal) / 2; instY2 = 0;
    }
    const buyoutM1 = pDollar(meta.costOfBuyOut);
    const swHwY = swHwM1 * 12, hwmY = hwmCostMonthly * 12, paysY = paysCostM1 * 12;

    const costY1         = swHwY + hwmY + paysY + instY1 + buyoutM1;
    const costY2         = swHwY + hwmY + paysY + instY2;
    const costGrandTotal = costY1 + costY2 + costY2;

    // ── Check 1: Prior Spend variance >= 15% ──
    const proposedMonthly = subM1 + paymentsRevM1 + gatewayRevM1;
    const priorVariance   = priorMonthly > 0
      ? ((proposedMonthly - priorMonthly) / priorMonthly) * 100 : null;
    const priorPass = priorVariance !== null ? priorVariance >= 15 : null;

    // ── Check 2: Year 1 margin % > 5% ──
    const pctY1  = revY1 > 0 ? ((revY1 - costY1) / revY1) * 100 : null;
    const y1Pass = pctY1 !== null ? pctY1 > 5 : null;

    // ── Check 3: 3-year total margin % > 40% ──
    const pctTotal = revGrandTotal > 0
      ? ((revGrandTotal - costGrandTotal) / revGrandTotal) * 100 : null;
    const y3Pass = pctTotal !== null ? pctTotal > 40 : null;

    // null = no data for that check → skip it (treat as not failing)
    return (priorPass !== false && y1Pass !== false && y3Pass !== false) ? "pass" : "fail";
  }, [spData, quote.meta, quote.groups, yesNoToggles, optionalProgramToggles,
      heatmapToggles, pitCategories, pitHourlyRate, catalogMap, heatmapItems, productCategories]);

  useEffect(() => {
    fetch(`${API_BASE}/api/products`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { categories?: ProductCategory[] } | null) => {
        if (data?.categories) setProductCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/pit-services`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { categories?: Array<{ id: string; name: string; lineItems: Array<{ id: string; name: string; duration?: number; price?: number }> }>; hourlyRate?: number } | null) => {
        if (!data) return;
        if (data.categories) {
          setPitCategories(
            data.categories.filter((c) => c.id !== "heatmap") as PitCategory[],
          );
          const heatCat = data.categories.find((c) => c.id === "heatmap");
          if (heatCat) {
            setHeatmapItems(
              heatCat.lineItems.filter((i) => i.price !== undefined) as HeatmapItem[],
            );
          }
        }
        if (typeof data.hourlyRate === "number" && data.hourlyRate > 0) {
          setPitHourlyRate(data.hourlyRate);
        }
      })
      .catch(() => {});
  }, []);
  // ── Dynamic alert configs loaded from DB ─────────────────────────────────
  interface AlertConfigRuntime {
    id: string;
    subjectProductId: string;
    lookupProductIds: string[];
    displayMessage: string;
    delaySeconds: number;
    infoOnly: boolean;
  }
  const [alertConfigs, setAlertConfigs] = useState<AlertConfigRuntime[]>([]);
  const [configAlertState, setConfigAlertState] = useState<null | {
    configId: string;
    subjectCount: number;
    subjectProductName: string;
    displayMessage: string;
    groupIdx: number;
    itemIdx: number;
    infoOnly: boolean;
  }>(null);
  const configTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Pre-flight alert queue (runs before export / new-quote)
  type AlertEntry = { configId: string; subjectCount: number; subjectProductName: string; displayMessage: string; groupIdx: number; itemIdx: number; infoOnly: boolean; };
  const [preflightAction, setPreflightAction] = useState<null | "export" | "new">(null);
  const [preflightQueue, setPreflightQueue] = useState<AlertEntry[]>([]);
  const preflightGroupsRef = useRef<QuoteGroup[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/alert-configs`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: AlertConfigRuntime[]) => { if (Array.isArray(data)) setAlertConfigs(data); })
      .catch(() => {});
  }, []);

  // Refs so timer callbacks always read the freshest groups state
  const latestGroupsRef = useRef(quote.groups);

  // Ref so timer callbacks always read the freshest modal state
  const configAlertStateRef = useRef(configAlertState);
  useEffect(() => { configAlertStateRef.current = configAlertState; }, [configAlertState]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      Object.values(configTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  const handleYesNoChange = (id: string, value: boolean) => {
    const next = { ...yesNoToggles, [id]: value };
    setYesNoToggles(next);
    const updated = { ...quote, meta: { ...quote.meta, yesNoToggles: next } };
    setQuote(updated);
    autosave(updated);
  };

  const handleOptionalProgramToggle = (id: string) => {
    const next = { ...optionalProgramToggles, [id]: !optionalProgramToggles[id] };
    setOptionalProgramToggles(next);
    const updated = { ...quote, meta: { ...quote.meta, optionalProgramToggles: next } };
    setQuote(updated);
    autosave(updated);
  };

  const handleHeatmapToggle = (id: string, value: boolean) => {
    const next = { ...heatmapToggles, [id]: value };
    setHeatmapToggles(next);
    const updated = { ...quote, meta: { ...quote.meta, heatmapToggles: next } };
    setQuote(updated);
    autosave(updated);
  };

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Load the correct quote once we know who the user is
  useEffect(() => {
    if (!userId || initialized) return;
    const activeId = getActiveQuoteId(userId);
    if (activeId) {
      const q = loadQuote(activeId, userId);
      if (q) {
        setQuote(q);
        if (q.meta.yesNoToggles) setYesNoToggles({ ...DEFAULT_YES_NO, ...q.meta.yesNoToggles });
        setOptionalProgramToggles({ ...DEFAULT_OPT_PROGRAMS, ...(q.meta.optionalProgramToggles ?? {}) });
        setHeatmapToggles({ ...DEFAULT_HEATMAP_TOGGLES, ...(q.meta.heatmapToggles ?? {}) });
        setInitialized(true);
        return;
      }
    }
    const all = loadAllQuotes(userId);
    if (all.length > 0) {
      const q = all[all.length - 1];
      setQuote(q);
      if (q.meta.yesNoToggles) setYesNoToggles({ ...DEFAULT_YES_NO, ...q.meta.yesNoToggles });
      setOptionalProgramToggles({ ...DEFAULT_OPT_PROGRAMS, ...(q.meta.optionalProgramToggles ?? {}) });
      setHeatmapToggles({ ...DEFAULT_HEATMAP_TOGGLES, ...(q.meta.heatmapToggles ?? {}) });
    }
    setInitialized(true);
  }, [userId, initialized]);

  /* Pull server quotes after init — merge any admin-edited or newer versions */
  useEffect(() => {
    if (!initialized || !userId) return;
    (async () => {
      const serverQuotes = await fetchServerQuotes();
      if (!serverQuotes.length) return;
      const localAll = loadAllQuotes(userId);
      const localMap = new Map(localAll.map((q) => [q.meta.id, q]));
      let changed = false;
      for (const sq of serverQuotes) {
        const lq = localMap.get(sq.meta.id);
        if (!lq || (!isDirtyRef.current && sq.meta.updatedAt >= lq.meta.updatedAt)) {
          localMap.set(sq.meta.id, sq);
          changed = true;
        }
      }
      if (changed) {
        const merged = Array.from(localMap.values());
        localStorage.setItem(`quote_builder_quotes__${userId}`, JSON.stringify(merged));
        setRefreshTrigger((n) => n + 1);
        const activeId = getActiveQuoteId(userId);
        if (activeId && !isDirtyRef.current) {
          const updated = localMap.get(activeId);
          if (updated) { setQuote(updated); }
        }
      }
    })();
  }, [initialized, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const autosave = useCallback(
    (q: Quote, markDirty = true, overrideStatus?: "pass" | "fail" | null) => {
      if (!userId) return;
      const ps = overrideStatus !== undefined ? overrideStatus : stampStatus;
      const updated = {
        ...q,
        meta: {
          ...q.meta,
          updatedAt: todayString(),
          ...(ps != null ? { passStatus: ps } : {}),
        },
      };
      saveQuote(updated, userId);
      syncQuoteToServer(updated);
      setRefreshTrigger((n) => n + 1);
      if (markDirty) isDirtyRef.current = true;
    },
    [userId, stampStatus]
  );

  // Sync all quote data to sessionStorage so StatusPassConfigPage can read it
  useEffect(() => {
    const meta = quote.meta;
    const TIER_IDS = new Set(["co-001", "co-002"]);
    const TIER_EXTRA_RATE = 6.30;
    let productPciSum = 0;
    let hwmCostMonthly = 0;

    const itemAttrMap = new Map<string, { pci: number; hwmc: number }>();
    for (const cat of productCategories) {
      for (const item of cat.items) {
        const a = item as unknown as { pci?: number; hwmc?: number };
        itemAttrMap.set(item.id, { pci: a.pci ?? 0, hwmc: a.hwmc ?? 0 });
      }
    }
    for (const group of quote.groups) {
      for (const li of group.lineItems) {
        const attrs = itemAttrMap.get(li.productId);
        if (!attrs) continue;
        const qty = li.quantity;
        if (attrs.pci > 0 && qty > 0) {
          if (TIER_IDS.has(li.productId) && qty > 1) {
            productPciSum += attrs.pci + (qty - 1) * TIER_EXTRA_RATE;
          } else {
            productPciSum += attrs.pci * qty;
          }
        }
        if (attrs.hwmc > 0 && qty > 0) hwmCostMonthly += attrs.hwmc * qty;
      }
    }

    const pitCat = pitCategories.find((c) => c.id === (meta.pitType ?? ""));
    const pitTotal = pitCat
      ? pitCat.lineItems.reduce((s, i) => s + i.duration * pitHourlyRate, 0)
      : 0;
    const productPitTotal = computeProductRelatedPitTotal(
      quote.groups, yesNoToggles, optionalProgramToggles,
      meta.pitType ?? "", catalogMap, pitHourlyRate,
    );
    const heatmapTotal = computeHeatmapTotal(
      heatmapToggles,
      heatmapItems.length > 0 ? heatmapItems : undefined,
    );

    sessionStorage.setItem("cpq_sp_context", JSON.stringify({
      quoteId: meta.id ?? "",
      quoteName: meta.companyName || meta.customerName || meta.quoteNumber || "Untitled Quote",
      annualRevenue: meta.annualStoreRevenue ?? "",
      avgTicket: meta.averageTicketAmount ?? "",
      numSites: meta.numberOfSites ?? "",
      requestedSubscriptionAmount: meta.requestedSubscriptionAmount ?? "",
      requestedUpfrontAmount: meta.requestedUpfrontAmount ?? "",
      basisPoint: meta.basisPoint ?? "",
      voyixPayTransactionFee: meta.voyixPayTransactionFee ?? "",
      aeCurrentMonthlySpend: meta.aeCurrentMonthlySpend ?? "",
      aeCurrentVoyixPaySpend: meta.aeCurrentVoyixPaySpend ?? "",
      productPciSum,
      hwmCostMonthly,
      ncrPay: meta.ncrPay ?? false,
      pitTotal,
      productPitTotal,
      heatmapTotal,
      recurringPit: meta.recurringPit ?? false,
      costOfBuyOut: meta.costOfBuyOut ?? "",
    }));
  }, [quote, yesNoToggles, heatmapToggles, optionalProgramToggles, pitCategories, pitHourlyRate, catalogMap, heatmapItems, productCategories]);

  const handleMetaChange = (meta: QuoteMeta) => {
    const updated = { ...quote, meta };
    setQuote(updated);
    autosave(updated);
  };

  const handlePitTypeChange = (pitType: string) => {
    const updated = { ...quote, meta: { ...quote.meta, pitType } };
    setQuote(updated);
    autosave(updated);
  };

  const handleRecurringPitChange = (val: boolean) => {
    const updated = { ...quote, meta: { ...quote.meta, recurringPit: val } };
    setQuote(updated);
    autosave(updated);
  };

  const handleGroupChange = (idx: number, group: QuoteGroup) => {
    const oldGroup = quote.groups[idx];
    const groups = quote.groups.map((g, i) => (i === idx ? group : g));
    const updated = { ...quote, groups };
    setQuote(updated);
    autosave(updated);

    // Keep ref fresh so timer callbacks read the latest state
    latestGroupsRef.current = groups;

    if (!oldGroup) return;

    // ── Dynamic DB-configured alert checks ──────────────────────────────────
    for (const cfg of alertConfigs) {
      const tryShowConfigAlert = (grps: QuoteGroup[]) => {
        if (configAlertStateRef.current) return; // don't stack modals
        const subject = findSubjectItem(grps, cfg.subjectProductId);
        if (!subject) return;

        if (cfg.infoOnly) {
          // info-only: skip entirely if every lookup product is already present (qty > 0)
          const anyMissing = cfg.lookupProductIds.some((lid) =>
            grps.reduce(
              (sum, g) => sum + g.lineItems.filter((li) => li.productId === lid).reduce((s, li) => s + li.quantity, 0),
              0,
            ) === 0,
          );
          if (!anyMissing) return;

          // auto-add the missing lookup products at qty=1
          const resolvedGroups = autoAddLookupProducts(grps, cfg.lookupProductIds, productCategories);
          if (resolvedGroups !== grps) {
            const updated = { ...quote, groups: resolvedGroups };
            setQuote(updated);
            autosave(updated);
            latestGroupsRef.current = resolvedGroups;
          }

          setConfigAlertState({
            configId: cfg.id,
            subjectCount: computeLookupCount(resolvedGroups, cfg.lookupProductIds),
            subjectProductName: subject.productName,
            displayMessage: cfg.displayMessage,
            groupIdx: subject.groupIdx,
            itemIdx: subject.itemIdx,
            infoOnly: true,
          });
        } else {
          const count = computeLookupCount(grps, cfg.lookupProductIds);
          if (count === subject.currentQty) return;
          setConfigAlertState({
            configId: cfg.id,
            subjectCount: count,
            subjectProductName: subject.productName,
            displayMessage: cfg.displayMessage,
            groupIdx: subject.groupIdx,
            itemIdx: subject.itemIdx,
            infoOnly: false,
          });
        }
      };

      const qtyChanged =
        lookupQtyChanged(oldGroup, group, cfg.lookupProductIds) ||
        subjectQtyChanged(oldGroup, group, cfg.subjectProductId);
      // For info-only alerts: only fire when the subject product itself is first added.
      // Never re-fire on qty changes or when lookup products are selected/modified.
      const productSelected = cfg.infoOnly
        ? subjectProductSelected(oldGroup, group, cfg.subjectProductId)
        : lookupProductSelected(oldGroup, group, cfg.lookupProductIds) ||
          subjectProductSelected(oldGroup, group, cfg.subjectProductId);

      if (qtyChanged && !cfg.infoOnly) {
        if (configTimersRef.current[cfg.id]) clearTimeout(configTimersRef.current[cfg.id]);
        delete configTimersRef.current[cfg.id];
        tryShowConfigAlert(groups);
      } else if (productSelected) {
        if (configTimersRef.current[cfg.id]) clearTimeout(configTimersRef.current[cfg.id]);
        const delaySec = cfg.delaySeconds > 0 ? cfg.delaySeconds * 1000 : 5000;
        configTimersRef.current[cfg.id] = setTimeout(() => {
          delete configTimersRef.current[cfg.id];
          tryShowConfigAlert(latestGroupsRef.current);
        }, delaySec);
      }
    }
  };

  const handleConfigAlertAutoAdjust = () => {
    if (!configAlertState) return;
    if (configAlertState.infoOnly) { handleConfigAlertKeep(); return; }
    const { subjectCount, groupIdx, itemIdx } = configAlertState;
    const baseGroups = preflightAction ? preflightGroupsRef.current : quote.groups;
    const groups = baseGroups.map((g, gi) => {
      if (gi !== groupIdx) return g;
      const lineItems = g.lineItems.map((item, li) =>
        li === itemIdx ? { ...item, quantity: subjectCount } : item,
      );
      return { ...g, lineItems };
    });
    const updated = { ...quote, groups };
    setQuote(updated);
    autosave(updated);
    setConfigAlertState(null);
    if (preflightAction) {
      preflightGroupsRef.current = groups;
      advancePreflightQueue(preflightQueue, preflightAction);
    }
  };

  const handleConfigAlertKeep = () => {
    setConfigAlertState(null);
    if (preflightAction) {
      advancePreflightQueue(preflightQueue, preflightAction);
    }
  };

  const handleGroupRemove = (idx: number) => {
    const groups = quote.groups.filter((_, i) => i !== idx);
    const updated = { ...quote, groups };
    setQuote(updated);
    autosave(updated);
  };

  const addGroup = (categoryId: string) => {
    const cat = productCategories.find((c) => c.id === categoryId);
    if (!cat) return;
    const newGroup: QuoteGroup = {
      id: generateId(),
      categoryId: cat.id,
      categoryName: cat.name,
      lineItems: [],
      isOpen: true,
    };
    const updated = { ...quote, groups: [...quote.groups, newGroup] };
    setQuote(updated);
    autosave(updated);
  };

  const handleSave = () => {
    autosave(quote, false);
    isDirtyRef.current = false;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const executeExportPDF = async () => {
    setExporting(true);
    try {
      await exportQuoteToPDF(
        quote, pitHourlyRate, stampStatus ?? undefined,
        pspmDiscountPct, upfrontPriceDiscountPct,
      );
    } finally {
      setExporting(false);
    }
  };

  const executeNewQuote = () => {
    const newQ = createNewQuote();
    setQuote(newQ);
    setYesNoToggles(DEFAULT_YES_NO);
    setOptionalProgramToggles(DEFAULT_OPT_PROGRAMS);
    setHeatmapToggles(DEFAULT_HEATMAP_TOGGLES);
    autosave(newQ, false);
    isDirtyRef.current = false;
    setSidebarOpen(false);
  };

  // Collect all alert-config mismatches for the given groups
  const collectMismatches = (groups: QuoteGroup[]): AlertEntry[] => {
    const result: AlertEntry[] = [];
    for (const cfg of alertConfigs) {
      const subject = findSubjectItem(groups, cfg.subjectProductId);
      if (!subject) continue;
      const count = computeLookupCount(groups, cfg.lookupProductIds);
      if (count === subject.currentQty) continue;
      result.push({
        configId: cfg.id,
        subjectCount: count,
        subjectProductName: subject.productName,
        displayMessage: cfg.displayMessage,
        groupIdx: subject.groupIdx,
        itemIdx: subject.itemIdx,
        infoOnly: cfg.infoOnly,
      });
    }
    return result;
  };

  // Show mismatches one by one; once resolved, execute the pending action
  const advancePreflightQueue = (remaining: AlertEntry[], action: "export" | "new") => {
    if (remaining.length > 0) {
      const [next, ...rest] = remaining;
      setPreflightQueue(rest);
      setConfigAlertState(next);
    } else {
      setPreflightAction(null);
      if (action === "export") executeExportPDF();
      if (action === "new") executeNewQuote();
    }
  };

  const runPreflightCheck = (action: "export" | "new") => {
    const mismatches = collectMismatches(latestGroupsRef.current);
    if (mismatches.length === 0) {
      if (action === "export") executeExportPDF();
      if (action === "new") executeNewQuote();
      return;
    }
    preflightGroupsRef.current = latestGroupsRef.current;
    setPreflightAction(action);
    const [first, ...rest] = mismatches;
    setPreflightQueue(rest);
    setConfigAlertState(first);
  };

  const handleExportPDF = () => {
    if (isDirtyRef.current) { setPendingAction("export"); return; }
    runPreflightCheck("export");
  };

  const handleNewQuote = () => {
    if (isDirtyRef.current) { setPendingAction("new"); return; }
    runPreflightCheck("new");
  };

  const handleUnsavedYes = () => {
    handleSave();
    const action = pendingAction;
    setPendingAction(null);
    if (action) runPreflightCheck(action);
  };

  const handleUnsavedNo = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action) runPreflightCheck(action);
  };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const handleSelectQuote = (q: Quote) => {
    setQuote(q);
    setYesNoToggles({ ...DEFAULT_YES_NO, ...(q.meta.yesNoToggles ?? {}) });
    setOptionalProgramToggles({ ...DEFAULT_OPT_PROGRAMS, ...(q.meta.optionalProgramToggles ?? {}) });
    setHeatmapToggles({ ...DEFAULT_HEATMAP_TOGGLES, ...(q.meta.heatmapToggles ?? {}) });
    setSidebarOpen(false);
  };

  const existingGroupIds = quote.groups.map((g) => g.categoryId);
  const allGroupsAdded = existingGroupIds.length >= productCategories.length;

  // ── Discount Analysis computations ──────────────────────────────────
  const parseDollarStr = (v?: string) =>
    parseFloat((v ?? "").replace(/[^0-9.]/g, "")) || 0;

  const _mrrTotal = quoteTotal(quote);
  const _pitCat = pitCategories.find((c) => c.id === (quote.meta.pitType ?? ""));
  const _pitTotal = _pitCat
    ? _pitCat.lineItems.reduce((s, i) => s + i.duration * pitHourlyRate, 0)
    : 0;
  const _productPitTotal = computeProductRelatedPitTotal(
    quote.groups, yesNoToggles, optionalProgramToggles,
    quote.meta.pitType ?? "", catalogMap, pitHourlyRate,
  );
  const _heatmapTotal = computeHeatmapTotal(
    heatmapToggles, heatmapItems.length > 0 ? heatmapItems : undefined,
  );
  const _upfrontTotal = _pitTotal + _productPitTotal + _heatmapTotal;
  const _reqSub = parseDollarStr(quote.meta.requestedSubscriptionAmount);
  const _reqUpfront = parseDollarStr(quote.meta.requestedUpfrontAmount);
  const pspmDiscountPct = _mrrTotal > 0
    ? ((_mrrTotal - _reqSub) / _mrrTotal) * 100
    : 0;
  const upfrontPriceDiscountPct = _upfrontTotal > 0
    ? ((_upfrontTotal - _reqUpfront) / _upfrontTotal) * 100
    : 0;

  return (
    <div className="app-shell">
      {/* Unsaved changes modal */}
      {pendingAction && (
        <UnsavedChangesModal onYes={handleUnsavedYes} onNo={handleUnsavedNo} />
      )}

      {/* Dynamic DB-configured alert modal */}
      {configAlertState && (
        <LicenseSyncModal
          deviceCount={configAlertState.subjectCount}
          licenseProductName={configAlertState.subjectProductName}
          displayMessage={configAlertState.displayMessage || undefined}
          infoOnly={configAlertState.infoOnly}
          onAutoAdjust={handleConfigAlertAutoAdjust}
          onKeep={handleConfigAlertKeep}
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-inner">
          <div className="sidebar-user">
            <button
              type="button"
              className="sidebar-user-btn"
              onClick={() => { setLocation("/profile"); setSidebarOpen(false); }}
            >
              <div className="sidebar-user-avatar">
                <span>{(user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase()}</span>
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.fullName || "Your Account"}</span>
                <span className="sidebar-user-email">{user?.email}</span>
              </div>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="sidebar-user-chevron">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <QuoteList
            currentId={quote.meta.id}
            currentStatus={stampStatus}
            onSelect={handleSelectQuote}
            onNew={handleNewQuote}
            refreshTrigger={refreshTrigger}
            userId={userId}
            userFullName={user?.fullName}
          />

          {user?.role === "admin" && (
            <div className="sidebar-admin-links">
              <button
                type="button"
                className="sidebar-admin-link"
                onClick={() => { setLocation("/admin/users"); setSidebarOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M13 7v4M11 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Users
              </button>
              <button
                type="button"
                className="sidebar-admin-link"
                onClick={() => { setLocation("/admin/products"); setSidebarOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                Products Configuration
              </button>
              <button
                type="button"
                className="sidebar-admin-link"
                onClick={() => { setLocation("/admin/pit"); setSidebarOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 12V4l5-2 5 2v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 14v-4h2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 7h2M10 7h2M4 10h2M10 10h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                PIT Configuration
              </button>
              <button
                type="button"
                className="sidebar-admin-link"
                onClick={() => { setLocation("/admin/media"); setSidebarOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="5.5" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1.5 11l3.5-3 3 3 2.5-2.5 3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Media Files
              </button>
              <button
                type="button"
                className="sidebar-admin-link"
                onClick={() => { setLocation("/admin/alerts"); setSidebarOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2a5 5 0 0 1 5 5c0 2.5.8 3.5 1.5 4.5H1.5C2.2 10.5 3 9.5 3 7a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6.5 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Alert Configuration
              </button>
              <button
                type="button"
                className="sidebar-admin-link"
                onClick={() => { setLocation("/admin/status-pass"); setSidebarOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 7v5.5M10.5 7v5.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                StatusPass Config
              </button>
              <button
                type="button"
                className="sidebar-admin-link sidebar-admin-link--highlight"
                onClick={() => { setLocation("/admin/quote-library"); setSidebarOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4.5 5.5h7M4.5 8h7M4.5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Quote Library
              </button>
            </div>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="main">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn-icon sidebar-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle quotes list"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <img src={logo} alt="Aloha Essential CPQ 3.0" className="topbar-logo" />
            <span className="topbar-brand">Aloha Essential CPQ 3.0</span>
          </div>
          <div className="topbar-actions">
            <button type="button" className="btn-ghost" onClick={handleSave}>
              {saved ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Saved
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M11 2H4L2 4v8h10V3l-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <rect x="5" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 2v3h4V2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  Save
                </>
              )}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportPDF}
              disabled={exporting}
            >
              {exporting ? (
                "Exporting…"
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v7M4.5 6.5L7 9l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Export
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="content" ref={printAreaRef}>
          <div className="content-inner">
            {/* Meta section */}
            <section className="section">
              <h2 className="section-title">Quote Details</h2>
              <QuoteMetaForm
                meta={quote.meta}
                onChange={handleMetaChange}
                pspmDiscountPct={pspmDiscountPct}
                upfrontPriceDiscountPct={upfrontPriceDiscountPct}
              />
            </section>

            {/* Current Aloha Essential Spend section */}
            <section className="section">
              <h2 className="section-title">Current Aloha Essential Spend</h2>
              <CurrentSpendForm meta={quote.meta} onChange={handleMetaChange} />
            </section>

            {/* PIT section */}
            <section className="section">
              <h2 className="section-title">PIT</h2>
              <PitSection
                pitType={quote.meta.pitType ?? ""}
                onChange={handlePitTypeChange}
                recurringPit={quote.meta.recurringPit ?? false}
                onRecurringPitChange={handleRecurringPitChange}
                yesNoToggles={yesNoToggles}
                onYesNoChange={handleYesNoChange}
                optionalProgramToggles={optionalProgramToggles}
                onOptionalProgramToggle={handleOptionalProgramToggle}
                pitCategories={pitCategories}
                pitHourlyRate={pitHourlyRate}
              />
            </section>

            {/* Product Related PIT section */}
            <section className="section">
              <h2 className="section-title">Product Related PIT</h2>
              <ProductRelatedPitSection
                groups={quote.groups}
                yesNoToggles={yesNoToggles}
                optionalProgramToggles={optionalProgramToggles}
                pitType={quote.meta.pitType ?? ""}
                catalogMap={catalogMap}
                pitHourlyRate={pitHourlyRate}
              />
            </section>

            {/* Heatmap & Cabling section */}
            <section className="section">
              <h2 className="section-title">Heatmap &amp; Cabling</h2>
              <HeatmapSection
                toggles={heatmapToggles}
                onToggle={handleHeatmapToggle}
                items={heatmapItems.length > 0 ? heatmapItems : undefined}
              />
            </section>

            {/* Payments Configuration Panel */}
            <section className="section">
              <h2 className="section-title">Payments Configuration Panel</h2>
              <PaymentsConfigPanel meta={quote.meta} onChange={handleMetaChange} />
            </section>

            {/* Groups section */}
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Line Items</h2>
              </div>

              <div className="groups-list">
                {quote.groups.map((group, idx) => (
                  <QuoteGroupComponent
                    key={group.id}
                    group={group}
                    catalog={productCategories}
                    onChange={(g) => handleGroupChange(idx, g)}
                    onRemove={() => handleGroupRemove(idx)}
                  />
                ))}
              </div>

              {quote.groups.length === 0 && (
                <div className="empty-groups">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.3">
                    <rect x="5" y="10" width="30" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5 16h30" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 22h8M12 26h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p>No groups yet. Add a product group to start building your quote.</p>
                </div>
              )}

              {!allGroupsAdded && (
                <button
                  type="button"
                  className="btn-add-group"
                  onClick={() => setShowAddGroup(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Add Product Group
                </button>
              )}
            </section>

            {/* Summary */}
            {quote.groups.some((g) => g.lineItems.length > 0) && (
              <section className="section summary-section">
                <h2 className="section-title">Summary</h2>
                <div className="summary-stamp-wrap">
                  <QuoteSummary
                    quote={quote}
                    pitTotal={_pitTotal}
                    productPitTotal={_productPitTotal}
                    heatmapTotal={_heatmapTotal}
                    legacyTotal={0}
                    pspmDiscountPct={pspmDiscountPct}
                    upfrontPriceDiscountPct={upfrontPriceDiscountPct}
                  />
                  {stampStatus && (
                    <div className="summary-stamp-overlay">
                      <img
                        className="summary-stamp-img"
                        src={stampStatus === "pass" ? "/pass.png" : "/fail.png"}
                        alt={stampStatus === "pass" ? "PASS" : "FAIL"}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {showAddGroup && (
        <AddGroupModal
          catalog={productCategories}
          existingGroupIds={existingGroupIds}
          onAdd={(id) => { addGroup(id); setShowAddGroup(false); }}
          onClose={() => setShowAddGroup(false)}
        />
      )}

    </div>
  );
}
