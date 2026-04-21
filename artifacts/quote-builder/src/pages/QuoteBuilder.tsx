import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import logo from "/logo.png";
import type { Quote, QuoteGroup, QuoteMeta } from "../types";
import catalog from "../data/products.json";
import pitData from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";
import QuoteMetaForm from "../components/QuoteMetaForm";
import CurrentSpendForm from "../components/CurrentSpendForm";
import HeatmapSection, { computeHeatmapTotal } from "../components/HeatmapSection";
import PaymentsConfigPanel from "../components/PaymentsConfigPanel";
import LegacyHwSection, { computeLegacyTotal } from "../components/LegacyHwSection";
import UnsavedChangesModal from "../components/UnsavedChangesModal";
import LicenseSyncModal from "../components/LicenseSyncModal";
import {
  deviceQtyChanged,
  deviceProductSelected,
  computeTotalDeviceCount,
  findLicenseItem,
} from "../utils/licenseSync";
import PitSection from "../components/PitSection";
import ProductRelatedPitSection, { computeProductRelatedPitTotal } from "../components/ProductRelatedPitSection";
import QuoteGroupComponent from "../components/QuoteGroup";
import QuoteSummary from "../components/QuoteSummary";
import QuoteList from "../components/QuoteList";
import AddGroupModal from "../components/AddGroupModal";
import { saveQuote, loadAllQuotes, getActiveQuoteId, loadQuote } from "../utils/storage";
import { exportQuoteToPDF } from "../utils/pdfExport";
import { generateId, todayString, thirtyDaysOut } from "../utils/calculations";

const productCategories = catalog.categories;

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

const DEFAULT_LEGACY_TOGGLES: Record<string, boolean> = {
  "boh-001": false,
  "fox-001": false,
  "fox-002": false,
  "km-001": false,
  "boh-002": false,
  "xl-001": false,
  "pay-001": false,
  "pay-002": false,
};

const DEFAULT_LEGACY_QUANTITIES: Record<string, number> = {
  "boh-001": 1,
  "fox-001": 1,
  "fox-002": 1,
  "km-001": 1,
  "boh-002": 1,
  "xl-001": 1,
  "pay-001": 1,
  "pay-002": 1,
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
  const [legacyToggles, setLegacyToggles] = useState<Record<string, boolean>>(DEFAULT_LEGACY_TOGGLES);
  const [legacyQuantities, setLegacyQuantities] = useState<Record<string, number>>(DEFAULT_LEGACY_QUANTITIES);
  const isDirtyRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<null | "export" | "new">(null);
  const [licenseSyncState, setLicenseSyncState] = useState<null | {
    deviceCount: number;
    licenseProductName: string;
    groupIdx: number;
    itemIdx: number;
  }>(null);

  // Refs so timer callbacks always read the freshest groups state
  const latestGroupsRef = useRef(quote.groups);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current);
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

  const handleLegacyToggle = (id: string, value: boolean) => {
    const next = { ...legacyToggles, [id]: value };
    setLegacyToggles(next);
    const updated = { ...quote, meta: { ...quote.meta, legacyToggles: next } };
    setQuote(updated);
    autosave(updated);
  };

  const handleLegacyQuantityChange = (id: string, qty: number) => {
    const next = { ...legacyQuantities, [id]: qty };
    setLegacyQuantities(next);
    const updated = { ...quote, meta: { ...quote.meta, legacyQuantities: next } };
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
        setLegacyToggles({ ...DEFAULT_LEGACY_TOGGLES, ...(q.meta.legacyToggles ?? {}) });
        setLegacyQuantities({ ...DEFAULT_LEGACY_QUANTITIES, ...(q.meta.legacyQuantities ?? {}) });
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
      setLegacyToggles({ ...DEFAULT_LEGACY_TOGGLES, ...(q.meta.legacyToggles ?? {}) });
      setLegacyQuantities({ ...DEFAULT_LEGACY_QUANTITIES, ...(q.meta.legacyQuantities ?? {}) });
    }
    setInitialized(true);
  }, [userId, initialized]);

  const autosave = useCallback(
    (q: Quote, markDirty = true) => {
      if (!userId) return;
      const updated = { ...q, meta: { ...q.meta, updatedAt: todayString() } };
      saveQuote(updated, userId);
      setRefreshTrigger((n) => n + 1);
      if (markDirty) isDirtyRef.current = true;
    },
    [userId]
  );

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

  // Shared helper — reads freshest groups from ref and shows modal if mismatched
  const tryShowLicenseSyncModal = useCallback((groups: QuoteGroup[]) => {
    const license = findLicenseItem(groups);
    if (!license) return;
    const deviceCount = computeTotalDeviceCount(groups);
    if (deviceCount === license.currentQty) return;
    const licenseName =
      groups[license.groupIdx]?.lineItems[license.itemIdx]?.productName ??
      license.productId;
    setLicenseSyncState({
      deviceCount,
      licenseProductName: licenseName,
      groupIdx: license.groupIdx,
      itemIdx: license.itemIdx,
    });
  }, []);

  const handleGroupChange = (idx: number, group: QuoteGroup) => {
    const oldGroup = quote.groups[idx];
    const groups = quote.groups.map((g, i) => (i === idx ? group : g));
    const updated = { ...quote, groups };
    setQuote(updated);
    autosave(updated);

    // Keep ref fresh so timer callbacks read the latest state
    latestGroupsRef.current = groups;

    if (!oldGroup) return;

    if (deviceQtyChanged(oldGroup, group)) {
      // Qty explicitly changed — cancel any pending timer and check immediately
      if (syncTimerRef.current !== null) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      tryShowLicenseSyncModal(groups);
    } else if (deviceProductSelected(oldGroup, group)) {
      // New device product selected — start 5-second countdown at default qty=1
      if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        tryShowLicenseSyncModal(latestGroupsRef.current);
      }, 5000);
    }
  };

  const handleLicenseAutoAdjust = () => {
    if (!licenseSyncState) return;
    const { deviceCount, groupIdx, itemIdx } = licenseSyncState;
    const groups = quote.groups.map((g, gi) => {
      if (gi !== groupIdx) return g;
      const lineItems = g.lineItems.map((item, li) =>
        li === itemIdx ? { ...item, quantity: deviceCount } : item,
      );
      return { ...g, lineItems };
    });
    const updated = { ...quote, groups };
    setQuote(updated);
    autosave(updated);
    setLicenseSyncState(null);
  };

  const handleLicenseKeep = () => setLicenseSyncState(null);

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
      await exportQuoteToPDF(quote);
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
    setLegacyToggles(DEFAULT_LEGACY_TOGGLES);
    setLegacyQuantities(DEFAULT_LEGACY_QUANTITIES);
    autosave(newQ, false);
    isDirtyRef.current = false;
    setSidebarOpen(false);
  };

  const handleExportPDF = () => {
    if (isDirtyRef.current) { setPendingAction("export"); return; }
    executeExportPDF();
  };

  const handleNewQuote = () => {
    if (isDirtyRef.current) { setPendingAction("new"); return; }
    executeNewQuote();
  };

  const handleUnsavedYes = async () => {
    handleSave();
    if (pendingAction === "export") await executeExportPDF();
    if (pendingAction === "new") executeNewQuote();
    setPendingAction(null);
  };

  const handleUnsavedNo = async () => {
    if (pendingAction === "export") await executeExportPDF();
    if (pendingAction === "new") executeNewQuote();
    setPendingAction(null);
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
    setLegacyToggles({ ...DEFAULT_LEGACY_TOGGLES, ...(q.meta.legacyToggles ?? {}) });
    setLegacyQuantities({ ...DEFAULT_LEGACY_QUANTITIES, ...(q.meta.legacyQuantities ?? {}) });
    setSidebarOpen(false);
  };

  const existingGroupIds = quote.groups.map((g) => g.categoryId);
  const allGroupsAdded = existingGroupIds.length >= productCategories.length;

  return (
    <div className="app-shell">
      {/* Unsaved changes modal */}
      {pendingAction && (
        <UnsavedChangesModal onYes={handleUnsavedYes} onNo={handleUnsavedNo} />
      )}

      {/* License sync modal */}
      {licenseSyncState && (
        <LicenseSyncModal
          deviceCount={licenseSyncState.deviceCount}
          licenseProductName={licenseSyncState.licenseProductName}
          onAutoAdjust={handleLicenseAutoAdjust}
          onKeep={handleLicenseKeep}
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
            onSelect={handleSelectQuote}
            onNew={handleNewQuote}
            refreshTrigger={refreshTrigger}
            userId={userId}
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
              <QuoteMetaForm meta={quote.meta} onChange={handleMetaChange} />
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
                yesNoToggles={yesNoToggles}
                onYesNoChange={handleYesNoChange}
                optionalProgramToggles={optionalProgramToggles}
                onOptionalProgramToggle={handleOptionalProgramToggle}
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
              />
            </section>

            {/* Heatmap & Cabling section */}
            <section className="section">
              <h2 className="section-title">Heatmap &amp; Cabling</h2>
              <HeatmapSection
                toggles={heatmapToggles}
                onToggle={handleHeatmapToggle}
              />
            </section>

            {/* Payments Configuration Panel */}
            <section className="section">
              <h2 className="section-title">Payments Configuration Panel</h2>
              <PaymentsConfigPanel meta={quote.meta} onChange={handleMetaChange} />
            </section>

            {/* Aloha Essential 2.0 HW */}
            <section className="section">
              <h2 className="section-title">Aloha Essential 2.0 HW</h2>
              <LegacyHwSection
                toggles={legacyToggles}
                onToggle={handleLegacyToggle}
                quantities={legacyQuantities}
                onQuantityChange={handleLegacyQuantityChange}
              />
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
                <QuoteSummary
                  quote={quote}
                  pitTotal={(() => {
                    const cat = pitData.categories.find((c) => c.id === (quote.meta.pitType ?? ""));
                    return cat ? cat.lineItems.reduce((s, i) => s + i.duration * PIT_HOURLY_RATE, 0) : 0;
                  })()}
                  productPitTotal={computeProductRelatedPitTotal(quote.groups, yesNoToggles, optionalProgramToggles, quote.meta.pitType ?? "")}
                  heatmapTotal={computeHeatmapTotal(heatmapToggles)}
                  legacyTotal={computeLegacyTotal(legacyToggles, legacyQuantities)}
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

    </div>
  );
}
