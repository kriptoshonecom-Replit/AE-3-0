import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useGlobalNav } from "@/context/GlobalNavContext";
import { useLocation } from "wouter";
import logo from "/logo.png";
import type { Quote, QuoteGroup, QuoteLineItem, QuoteMeta, ProductCategory, PitCategory } from "../types";
import catalog from "../data/products.json";
import pitDataStatic from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";
import QuoteMetaForm from "../components/QuoteMetaForm";
import CurrentSpendForm from "../components/CurrentSpendForm";
import AddressMapSection from "../components/AddressMapSection";
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
import ProductRelatedPitSection, { computeProductRelatedPitTotal, computeProductRelatedPitHours, buildProductCatalogMap, type ProductCatalogMap } from "../components/ProductRelatedPitSection";
import QuoteGroupComponent from "../components/QuoteGroup";
import QuoteSummary from "../components/QuoteSummary";
import QuoteList from "../components/QuoteList";
import AddGroupModal from "../components/AddGroupModal";
import AmendModal from "../components/AmendModal";
import { saveQuote, loadAllQuotes, getActiveQuoteId, loadQuote, consumePendingOpenQuote } from "../utils/storage";
import { syncQuoteToServer, saveQuoteToServerNow, adminSaveQuoteToServer, fetchServerQuotes, bulkUploadQuotesToServer } from "../utils/serverSync";
import { exportQuoteToPDF } from "../utils/pdfExport";
import { generateId, todayString, thirtyDaysOut, quoteTotal } from "../utils/calculations";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const DEFAULT_YES_NO: Record<string, boolean> = {
  "connected-payments-yn": false,
  "online-ordering-yn": false,
};

// Optional program toggles are now fully dynamic (keyed by product ID).
// No static defaults — all products default to included (true) unless explicitly toggled off.
const DEFAULT_OPT_PROGRAMS: Record<string, boolean> = {};

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
  const [showAmendModal, setShowAmendModal] = useState(false);
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useGlobalNav();
  const [activeTab, setActiveTab] = useState(0);
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE}/api/app-version`)
      .then((r) => r.json())
      .then((d: { version?: string }) => { if (d.version) setAppVersion(d.version); })
      .catch(() => {});
  }, []);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [yesNoToggles, setYesNoToggles] = useState<Record<string, boolean>>(DEFAULT_YES_NO);
  const [optionalProgramToggles, setOptionalProgramToggles] = useState<Record<string, boolean>>(DEFAULT_OPT_PROGRAMS);
  const [heatmapToggles, setHeatmapToggles] = useState<Record<string, boolean>>(DEFAULT_HEATMAP_TOGGLES);
  const isDirtyRef = useRef(false);
  const groupDragSrc = useRef<number | null>(null);
  const [groupDragOver, setGroupDragOver] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<null | "export" | "new">(null);
  // Tracks the original owner's userId when admin is editing another user's quote
  const [editingOtherUserId, setEditingOtherUserId] = useState<string | null>(null);

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
  const [tieredAdditionalPrice, setTieredAdditionalPrice] = useState<number>(30);

  const [heatmapItems, setHeatmapItems] = useState<HeatmapItem[]>(() => {
    const cat = (pitDataStatic.categories as Array<{ id: string; lineItems: Array<{ id: string; name: string; price?: number }> }>).find(
      (c) => c.id === "heatmap",
    );
    return cat ? (cat.lineItems.filter((i) => i.price !== undefined) as HeatmapItem[]) : [];
  });

  // ── Status Pass stamp ──────────────────────────────────────
  const [spData, setSpData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/status-pass/rates`, { credentials: "include" })
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
      .then((data: { categories?: ProductCategory[]; tieredAdditionalPrice?: number } | null) => {
        if (data?.categories) setProductCategories(data.categories);
        if (typeof data?.tieredAdditionalPrice === "number") setTieredAdditionalPrice(data.tieredAdditionalPrice);
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

    // Quote Library redirected here with a specific quote to open
    const pending = consumePendingOpenQuote();
    if (pending) {
      const { quote: pq, ownerId } = pending;
      if (ownerId !== userId) {
        // Admin opening another user's quote — tag it so saves go to the right owner
        const taggedMeta = { ...pq.meta, _adminOwnerId: ownerId } as typeof pq.meta;
        handleSelectQuote({ ...pq, meta: taggedMeta });
      } else {
        setQuote(pq);
        if (pq.meta.yesNoToggles) setYesNoToggles({ ...DEFAULT_YES_NO, ...pq.meta.yesNoToggles });
        setOptionalProgramToggles({ ...DEFAULT_OPT_PROGRAMS, ...(pq.meta.optionalProgramToggles ?? {}) });
        setHeatmapToggles({ ...DEFAULT_HEATMAP_TOGGLES, ...(pq.meta.heatmapToggles ?? {}) });
      }
      setInitialized(true);
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, initialized]);

  /* On startup: pull server quotes, migrate any localStorage-only quotes,
     then refresh the sidebar and update the open form if the server has a
     newer version of the active quote. */
  useEffect(() => {
    if (!initialized || !userId) return;
    (async () => {
      const serverQuotes = await fetchServerQuotes();
      // null = network / auth error — leave everything as-is
      if (serverQuotes === null) return;

      const localAll = loadAllQuotes(userId);
      const serverIds = new Set(serverQuotes.map((q) => q.meta.id));

      // Upload any quotes that exist only in localStorage (migration for quotes
      // created before server sync was in place, or on first production visit).
      const localOnly = localAll.filter((q) => !serverIds.has(q.meta.id));
      if (localOnly.length > 0) {
        await bulkUploadQuotesToServer(localOnly);
      }

      // Signal the sidebar to re-fetch its list from the server.
      setRefreshTrigger((n) => n + 1);

      // If the user has unsaved edits to the current quote, leave the form alone.
      if (isDirtyRef.current) return;

      const activeId = getActiveQuoteId(userId);
      if (!activeId) return;

      const serverVersion = serverQuotes.find((q) => q.meta.id === activeId);
      const localVersion = localAll.find((q) => q.meta.id === activeId);

      if (serverVersion) {
        // Use server version if it's newer (e.g. edited by admin on another device)
        if (!localVersion || serverVersion.meta.updatedAt >= localVersion.meta.updatedAt) {
          setQuote(serverVersion);
          saveQuote(serverVersion, userId); // keep localStorage cache in sync
        }
      } else if (serverQuotes.length > 0) {
        // Active quote was deleted server-side — load the most recent remaining one
        const latest = [...serverQuotes].sort((a, b) =>
          (b.meta.updatedAt ?? "").localeCompare(a.meta.updatedAt ?? ""),
        )[0];
        setQuote(latest);
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
      if (editingOtherUserId) {
        // Admin editing another user's quote — write through the admin endpoint
        // so the original owner's record is updated with proper attribution.
        // Do NOT save to localStorage (it belongs to the original owner, not admin).
        adminSaveQuoteToServer(updated.meta.id, updated);
      } else {
        // Write to localStorage immediately (fast cache for form restore on reload).
        saveQuote(updated, userId);
        // Push to server; once confirmed, refresh the sidebar from server.
        syncQuoteToServer(updated, () => setRefreshTrigger((n) => n + 1));
      }
      if (markDirty) isDirtyRef.current = true;
    },
    [userId, stampStatus, editingOtherUserId]
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
    const { subjectCount, configId } = configAlertState;
    const baseGroups = preflightAction ? preflightGroupsRef.current : quote.groups;
    // Re-resolve subject position at apply-time so drag reordering can't
    // leave us with stale groupIdx/itemIdx pointing at the wrong group.
    const cfg = alertConfigs.find((c) => c.id === configId);
    const freshSubject = cfg ? findSubjectItem(baseGroups, cfg.subjectProductId) : null;
    const resolvedGroupIdx = freshSubject?.groupIdx ?? configAlertState.groupIdx;
    const resolvedItemIdx = freshSubject?.itemIdx ?? configAlertState.itemIdx;
    const groups = baseGroups.map((g, gi) => {
      if (gi !== resolvedGroupIdx) return g;
      const lineItems = g.lineItems.map((item, li) =>
        li === resolvedItemIdx ? { ...item, quantity: subjectCount } : item,
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
        voyixTxnFee, gatewayTxnRate, tieredAdditionalPrice,
        appVersion || undefined,
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
    // Save to localStorage immediately (form cache).
    saveQuote(newQ, userId!);
    isDirtyRef.current = false;
    setSidebarOpen(false);
    // Save to server immediately (no debounce) so the new quote appears
    // in the sidebar as soon as the server confirms — no 1.5 s wait.
    void saveQuoteToServerNow(newQ).then(() => setRefreshTrigger((n) => n + 1));
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

  const handleDuplicateQuote = async (q: Quote) => {
    const res = await fetch(`/api/quotes/${q.meta.id}/duplicate`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      alert("Failed to duplicate quote. Please try again.");
      return;
    }
    const { quote: newQuote } = (await res.json()) as { quote: Quote };
    saveQuote(newQuote, userId!);
    handleSelectQuote(newQuote);
    setRefreshTrigger((n) => n + 1);
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
    // Detect admin editing another user's quote
    const rawMeta = q.meta as unknown as Record<string, unknown>;
    const ownerId = rawMeta._adminOwnerId as string | undefined;
    if (ownerId && ownerId !== userId) {
      setEditingOtherUserId(ownerId);
    } else {
      setEditingOtherUserId(null);
    }
    // Strip the injected _adminOwnerId before loading into state
    const { _adminOwnerId: _drop, ...cleanMeta } = rawMeta;
    void _drop;
    const cleanQuote = { ...q, meta: cleanMeta as unknown as typeof q.meta };
    setQuote(cleanQuote);
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
  const _pitHours = _pitCat
    ? _pitCat.lineItems.reduce((s, i) => s + i.duration, 0)
    : 0;
  const _productPitHours = computeProductRelatedPitHours(
    quote.groups, yesNoToggles, optionalProgramToggles,
    quote.meta.pitType ?? "", catalogMap,
  );
  const _recurringPit = quote.meta.recurringPit ?? false;
  const _upfrontOverride = _recurringPit
    ? (_pitHours + _productPitHours) * 4
    : undefined;
  const _upfrontTotal = _pitTotal + _productPitTotal + _heatmapTotal;
  const _reqSub = parseDollarStr(quote.meta.requestedSubscriptionAmount);
  const _reqUpfront = parseDollarStr(quote.meta.requestedUpfrontAmount);
  const pspmDiscountPct = _mrrTotal > 0
    ? ((_mrrTotal - _reqSub) / _mrrTotal) * 100
    : 0;
  const upfrontPriceDiscountPct = _upfrontTotal > 0
    ? ((_upfrontTotal - _reqUpfront) / _upfrontTotal) * 100
    : 0;

  // ── Payments Overview computations ──────────────────────────────────
  const voyixTxnFee = parseFloat(quote.meta.voyixPayTransactionFee ?? "") || 0;
  const _numSites   = parseFloat(quote.meta.numberOfSites ?? "") || 0;
  const _annualRev  = parseDollarStr(quote.meta.annualStoreRevenue);
  const _avgTicket  = parseDollarStr(quote.meta.averageTicketAmount);
  const _txnCount   = _avgTicket > 0 ? _annualRev / _avgTicket : 0;
  const _catId      = quote.meta.ncrPay ? "voyix-pay-yes" : "voyix-pay-no";
  const _modelId    = _numSites > 0 && _numSites < 10 ? "smb"
    : _numSites >= 10 && _numSites <= 50 ? "mid-market"
    : _numSites > 50 ? "enterprise" : "";
  const _rawTxnCount = _txnCount > 0 && _numSites > 0
    ? Math.round((_txnCount / 12) * _numSites / 10) * 10 : 0;
  type _SpTier  = { lowVolume: number; highVolume: number; txnRate: number };
  type _SpModel = { id: string; tiers: _SpTier[] };
  type _SpCat   = { id: string; models: _SpModel[] };
  const _spCats  = (spData?.categories ?? []) as _SpCat[];
  const _spModel = _spCats.find((c) => c.id === _catId)?.models.find((m) => m.id === _modelId);
  const gatewayTxnRate = (() => {
    if (!_spModel || _rawTxnCount === 0) return 0;
    let rem = _rawTxnCount, fees = 0;
    for (let i = 0; i < _spModel.tiers.length; i++) {
      const t = _spModel.tiers[i];
      const isLast = t.highVolume === t.lowVolume;
      const prevHigh = i === 0 ? 0 : _spModel.tiers[i - 1].highVolume;
      const cap = isLast ? Infinity : i === 0 ? t.highVolume : t.highVolume - prevHigh;
      const used = Math.min(rem, cap);
      fees += used * t.txnRate;
      rem = Math.max(0, rem - used);
      if (rem === 0) break;
    }
    return _rawTxnCount > 0 ? fees / _rawTxnCount : 0;
  })();

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

      {createPortal(
        <QuoteList
          currentId={quote.meta.id}
          currentStatus={stampStatus}
          onSelect={handleSelectQuote}
          onNew={handleNewQuote}
          onDuplicate={handleDuplicateQuote}
          refreshTrigger={refreshTrigger}
          userId={userId}
          userFullName={user?.fullName}
          isAdmin={user?.role === "admin"}
          apiBase={API_BASE}
        />,
        document.getElementById("global-sidebar-slot") ?? document.body
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

        {/* Tab bar */}
        <div className="qb-tab-bar">
          <button className={`qb-tab${activeTab === 0 ? " qb-tab-active" : ""}`} onClick={() => setActiveTab(0)}>
            Quote
          </button>
          <button className={`qb-tab${activeTab === 1 ? " qb-tab-active" : ""}`} onClick={() => setActiveTab(1)}>
            Line Items
          </button>
          <button className={`qb-tab${activeTab === 2 ? " qb-tab-active" : ""}`} onClick={() => setActiveTab(2)}>
            Payments &amp; PIT
          </button>
          <button className={`qb-tab${activeTab === 3 ? " qb-tab-active" : ""}`} onClick={() => setActiveTab(3)}>
            Product PIT
          </button>
        </div>

        {/* Content */}
        <div className="content" ref={printAreaRef}>
          <div className="content-inner">

            {/* ── Tab 0: Quote ── */}
            {activeTab === 0 && (
              <>
                <section className="section">
                  <h2 className="section-title">Current Aloha Essential Spend</h2>
                  <CurrentSpendForm meta={quote.meta} onChange={handleMetaChange} />
                </section>

                <section className="section">
                  <h2 className="section-title">Quote Details</h2>
                  <QuoteMetaForm
                    meta={quote.meta}
                    onChange={handleMetaChange}
                    pspmDiscountPct={pspmDiscountPct}
                    upfrontPriceDiscountPct={upfrontPriceDiscountPct}
                  />
                </section>

                <section className="section">
                  <h2 className="section-title">Business Operation Address</h2>
                  <div className="quote-meta-form">
                    <AddressMapSection
                      values={{
                        addressName: quote.meta.addressName ?? "",
                        addressNumber: quote.meta.addressNumber ?? "",
                        addressCity: quote.meta.addressCity ?? "",
                        addressState: quote.meta.addressState ?? "",
                        zipCode: quote.meta.zipCode ?? "",
                        addressCountry: quote.meta.addressCountry ?? "United States",
                      }}
                      onChange={(fields) => handleMetaChange({ ...quote.meta, ...fields })}
                      sameForBilling={quote.meta.sameForBilling ?? true}
                      billingValues={{
                        billingAddressName: quote.meta.billingAddressName ?? "",
                        billingAddressNumber: quote.meta.billingAddressNumber ?? "",
                        billingAddressCity: quote.meta.billingAddressCity ?? "",
                        billingAddressState: quote.meta.billingAddressState ?? "",
                        billingZipCode: quote.meta.billingZipCode ?? "",
                        billingAddressCountry: quote.meta.billingAddressCountry ?? "United States",
                      }}
                      onBillingChange={(fields) => handleMetaChange({ ...quote.meta, ...fields })}
                    />
                    <div className="field-group" style={{ marginTop: 12 }}>
                      <label>Notes</label>
                      <textarea
                        value={quote.meta.notes}
                        onChange={(e) => handleMetaChange({ ...quote.meta, notes: e.target.value })}
                        rows={3}
                        placeholder="Payment terms, delivery notes, special conditions…"
                      />
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ── Tab 1: Line Items ── */}
            {activeTab === 1 && (
              <>
                <section className="section">
                  <div className="section-header">
                    <h2 className="section-title">Line Items</h2>
                    {quote.groups.length > 0 && (() => {
                      const allOpen = quote.groups.every((g) => g.isOpen);
                      return (
                        <button
                          type="button"
                          className="btn-collapse-all"
                          title={allOpen ? "Collapse all" : "Expand all"}
                          onClick={() =>
                            setQuote({
                              ...quote,
                              groups: quote.groups.map((g) => ({ ...g, isOpen: !allOpen })),
                            })
                          }
                        >
                          <span className={`chevron${allOpen ? " rotated" : ""}`}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                  <div className="groups-list">
                    {quote.groups.map((group, idx) => (
                      <QuoteGroupComponent
                        key={group.id}
                        group={group}
                        catalog={productCategories}
                        onChange={(g) => handleGroupChange(idx, g)}
                        onRemove={() => handleGroupRemove(idx)}
                        tieredAdditionalPrice={tieredAdditionalPrice}
                        isDragging={groupDragSrc.current === idx}
                        isDragOver={groupDragOver === idx}
                        onDragStart={() => { groupDragSrc.current = idx; }}
                        onDragOver={(e) => { e.preventDefault(); if (groupDragOver !== idx) setGroupDragOver(idx); }}
                        onDragEnd={() => { groupDragSrc.current = null; setGroupDragOver(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = groupDragSrc.current;
                          if (from === null || from === idx) { setGroupDragOver(null); return; }
                          const groups = [...quote.groups];
                          const [moved] = groups.splice(from, 1);
                          groups.splice(idx, 0, moved);
                          setQuote({ ...quote, groups });
                          latestGroupsRef.current = groups;
                          groupDragSrc.current = null;
                          setGroupDragOver(null);
                        }}
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

                {quote.groups.some((g) => g.lineItems.length > 0) && (
                  <section className="section summary-section">
                    <div className="section-header">
                      <h2 className="section-title">Summary</h2>
                      {stampStatus === "pass" && (
                        <button
                          type="button"
                          className="btn-amend"
                          onClick={() => setShowAmendModal(true)}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Amend
                        </button>
                      )}
                    </div>
                    <div className="summary-stamp-wrap">
                      <QuoteSummary
                        quote={quote}
                        pitTotal={_pitTotal}
                        productPitTotal={_productPitTotal}
                        heatmapTotal={_heatmapTotal}
                        legacyTotal={0}
                        pspmDiscountPct={pspmDiscountPct}
                        upfrontPriceDiscountPct={upfrontPriceDiscountPct}
                        voyixTxnFee={voyixTxnFee}
                        gatewayTxnRate={gatewayTxnRate}
                        recurringPit={_recurringPit}
                        upfrontOverride={_upfrontOverride}
                        pitHours={_pitHours}
                        productPitHours={_productPitHours}
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
                    {stampStatus === "pass" && (
                      <div className="amend-btn-mobile-wrap">
                        <button
                          type="button"
                          className="btn-amend"
                          onClick={() => setShowAmendModal(true)}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Amend
                        </button>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {/* ── Tab 2: Payments & PIT ── */}
            {activeTab === 2 && (
              <>
                <section className="section">
                  <h2 className="section-title">Payments Configuration Panel</h2>
                  <PaymentsConfigPanel meta={quote.meta} onChange={handleMetaChange} />
                </section>

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
                    groups={quote.groups}
                    catalogMap={catalogMap}
                  />
                </section>

                <section className="section">
                  <h2 className="section-title">Heatmap &amp; Cabling</h2>
                  <HeatmapSection
                    toggles={heatmapToggles}
                    onToggle={handleHeatmapToggle}
                    items={heatmapItems.length > 0 ? heatmapItems : undefined}
                  />
                </section>
              </>
            )}

            {/* ── Tab 3: Product Related PIT ── */}
            {activeTab === 3 && (
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

      {showAmendModal && (
        <AmendModal
          quote={quote}
          tieredAdditionalPrice={tieredAdditionalPrice}
          onClose={() => setShowAmendModal(false)}
          onSaved={() => setShowAmendModal(false)}
        />
      )}

    </div>
  );
}
