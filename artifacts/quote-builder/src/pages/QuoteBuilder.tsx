import { useState, useCallback, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import logo from "/logo.png";
import type { Quote, QuoteGroup, QuoteMeta } from "../types";
import catalog from "../data/products.json";
import pitData from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";
import QuoteMetaForm from "../components/QuoteMetaForm";
import PitSection from "../components/PitSection";
import ProductRelatedPitSection, { computeProductRelatedPitTotal } from "../components/ProductRelatedPitSection";
import QuoteGroupComponent from "../components/QuoteGroup";
import QuoteSummary from "../components/QuoteSummary";
import QuoteList from "../components/QuoteList";
import AddGroupModal from "../components/AddGroupModal";
import { saveQuote, loadAllQuotes, getActiveQuoteId, loadQuote } from "../utils/storage";
import { exportQuoteToPDF } from "../utils/pdfExport";
import { generateId, todayString, thirtyDaysOut } from "../utils/calculations";
import { getQtySyncCheck, applyQtySync, getPinPadSyncCheck, applyPinPadSync } from "../utils/quoteLogic";
import type { QtySyncCheck, PinPadSyncCheck } from "../utils/quoteLogic";

const productCategories = catalog.categories;

const DEFAULT_YES_NO: Record<string, boolean> = {
  "connected-payments-yn": false,
  "online-ordering-yn": false,
};

const DEFAULT_OPT_PROGRAMS: Record<string, boolean> = {
  "connected-payments": true,
  "online-ordering": true,
  "consumer-marketing": true,
  "insight-or-console": true,
  "aloha-api": true,
  "kitchen": true,
  "orderpay": true,
  "aloha-delivery": true,
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
  const { user } = useUser();
  const userId = user?.id ?? "";
  const [, setLocation] = useLocation();

  const [quote, setQuote] = useState<Quote>(createNewQuote);
  const [initialized, setInitialized] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [qtyMismatch, setQtyMismatch] = useState<QtySyncCheck | null>(null);
  const [pinPadMismatch, setPinPadMismatch] = useState<PinPadSyncCheck | null>(null);
  const [yesNoToggles, setYesNoToggles] = useState<Record<string, boolean>>(DEFAULT_YES_NO);
  const [optionalProgramToggles, setOptionalProgramToggles] = useState<Record<string, boolean>>(DEFAULT_OPT_PROGRAMS);

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
    }
    setInitialized(true);
  }, [userId, initialized]);

  const autosave = useCallback(
    (q: Quote) => {
      if (!userId) return;
      const updated = { ...q, meta: { ...q.meta, updatedAt: todayString() } };
      saveQuote(updated, userId);
      setRefreshTrigger((n) => n + 1);
    },
    [userId]
  );

  const handleMetaChange = (meta: QuoteMeta) => {
    const updated = { ...quote, meta };
    setQuote(updated);
    autosave(updated);
  };

  const handlePitTypeChange = (pitType: string) => {
    const nextYesNo = pitType === "refresh"
      ? { ...yesNoToggles, "connected-payments-yn": false, "online-ordering-yn": false }
      : { ...yesNoToggles, "connected-payments-yn": true, "online-ordering-yn": true };
    setYesNoToggles(nextYesNo);
    const updated = { ...quote, meta: { ...quote.meta, pitType, yesNoToggles: nextYesNo } };
    setQuote(updated);
    autosave(updated);
  };

  const PIN_PAD_IDS = ["pi-001", "pi-002", "pi-005", "pi-006", "pi-008", "pi-009"];

  const handleGroupChange = (idx: number, group: QuoteGroup) => {
    const oldGroup = quote.groups[idx];
    const groups = quote.groups.map((g, i) => (i === idx ? group : g));
    const updated = { ...quote, groups };
    setQuote(updated);
    autosave(updated);
    const check = getQtySyncCheck(groups);
    if (check.needed) setQtyMismatch(check);

    const oldPinPadIds = new Set(
      (oldGroup?.lineItems ?? [])
        .filter((i) => PIN_PAD_IDS.includes(i.productId))
        .map((i) => i.productId)
    );
    const newlyAddedPinPad = group.lineItems.some(
      (i) => PIN_PAD_IDS.includes(i.productId) && !oldPinPadIds.has(i.productId)
    );
    if (newlyAddedPinPad) {
      const pinCheck = getPinPadSyncCheck(groups);
      if (pinCheck.needed) setPinPadMismatch(pinCheck);
    }
  };

  const handleQtyAutoMatch = () => {
    const syncedGroups = applyQtySync(quote.groups);
    const updated = { ...quote, groups: syncedGroups };
    setQuote(updated);
    autosave(updated);
    setQtyMismatch(null);
  };

  const handlePinPadAutoMatch = () => {
    const syncedGroups = applyPinPadSync(quote.groups);
    const updated = { ...quote, groups: syncedGroups };
    setQuote(updated);
    autosave(updated);
    setPinPadMismatch(null);
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
    autosave(quote);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportQuoteToPDF(quote);
    } finally {
      setExporting(false);
    }
  };

  const handleNewQuote = () => {
    const newQ = createNewQuote();
    setQuote(newQ);
    autosave(newQ);
    setSidebarOpen(false);
  };

  const handleSelectQuote = (q: Quote) => {
    setQuote(q);
    setYesNoToggles({ ...DEFAULT_YES_NO, ...(q.meta.yesNoToggles ?? {}) });
    setOptionalProgramToggles({ ...DEFAULT_OPT_PROGRAMS, ...(q.meta.optionalProgramToggles ?? {}) });
    setSidebarOpen(false);
  };

  const existingGroupIds = quote.groups.map((g) => g.categoryId);
  const allGroupsAdded = existingGroupIds.length >= productCategories.length;

  return (
    <div className="app-shell">
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
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.fullName || "User"} />
                ) : (
                  <span>{(user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U").toUpperCase()}</span>
                )}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.fullName || user?.firstName || "Your Account"}</span>
                <span className="sidebar-user-email">{user?.primaryEmailAddress?.emailAddress}</span>
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
                  productPitTotal={computeProductRelatedPitTotal(quote.groups, yesNoToggles, optionalProgramToggles)}
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

      {pinPadMismatch && (
        <div className="modal-backdrop" onClick={() => setPinPadMismatch(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="qty-sync-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="#f59e0b" strokeWidth="1.8" fill="#fef3c7" />
                <path d="M14 9v6" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="19.5" r="1.2" fill="#d97706" />
              </svg>
            </div>
            <h3 className="qty-sync-title">Pin Pad Quantity Mismatch</h3>
            <p className="qty-sync-body">
              The device count is ({pinPadMismatch.deviceCount}), but it's not matching up with the number of terminals ({pinPadMismatch.pinPadCount} pin pads selected).
            </p>
            <div className="qty-sync-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPinPadMismatch(null)}
              >
                Keep as is
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handlePinPadAutoMatch}
              >
                Auto-match to {pinPadMismatch.deviceCount}
              </button>
            </div>
          </div>
        </div>
      )}

      {qtyMismatch && (
        <div className="modal-backdrop" onClick={() => setQtyMismatch(null)}>
          <div className="modal-box qty-sync-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qty-sync-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="#f59e0b" strokeWidth="1.8" fill="#fef3c7" />
                <path d="M14 9v6" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="19.5" r="1.2" fill="#d97706" />
              </svg>
            </div>
            <h3 className="qty-sync-title">Quantity Mismatch</h3>
            <p className="qty-sync-body">
              Total Device quantity ({qtyMismatch.terminalQty}) doesn't match
              total <strong>Core</strong> quantity ({qtyMismatch.coreQty}).
              <br />
              Core licenses must match the number of terminals.
            </p>
            <div className="qty-sync-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setQtyMismatch(null)}
              >
                Keep as is
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleQtyAutoMatch}
              >
                Auto-match to {qtyMismatch.terminalQty}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
