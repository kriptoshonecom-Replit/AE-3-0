import { useState, useEffect, useMemo } from "react";
import type { Quote } from "../types";
import { computeLineItemTotal } from "../utils/quoteLogic";
import { formatCurrency, generateId } from "../utils/calculations";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface AmendModalProps {
  quote: Quote;
  tieredAdditionalPrice: number;
  onClose: () => void;
  onSaved: () => void;
  /** Edit-mode: if set, PATCHes this amendment id instead of POSTing a new one */
  editAmendmentId?: string;
  editAmendmentNumber?: number;
  initialAmendedQty?: Record<string, number>;
  initialQuoteNumber?: string;
  initialNotes?: string;
}

export default function AmendModal({
  quote,
  tieredAdditionalPrice,
  onClose,
  onSaved,
  editAmendmentId,
  editAmendmentNumber,
  initialAmendedQty,
  initialQuoteNumber,
  initialNotes,
}: AmendModalProps) {
  const isEditMode = Boolean(editAmendmentId);

  const [quoteNumber, setQuoteNumber] = useState(initialQuoteNumber ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [loadingCount, setLoadingCount] = useState(!isEditMode);
  // In create mode, we always re-fetch the quote from the server to ensure
  // we have the authoritative version (not a stale browser/localStorage copy).
  const [loadingQuote, setLoadingQuote] = useState(!isEditMode);
  const [serverQuote, setServerQuote] = useState<Quote | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The quote we render groups from: server version (fresh) → prop fallback
  const activeQuote = serverQuote ?? quote;

  // amendedQty keyed by line item id — initialised from prop in edit mode,
  // or from the server quote once it arrives in create mode.
  const [amendedQty, setAmendedQty] = useState<Record<string, number>>(() => {
    if (initialAmendedQty) return { ...initialAmendedQty };
    const map: Record<string, number> = {};
    for (const g of quote.groups) {
      const items = Array.isArray(g.lineItems) ? g.lineItems : [];
      for (const li of items) {
        if (li && li.id) map[li.id] = li.quantity ?? 0;
      }
    }
    return map;
  });

  // In create mode: fetch the quote fresh from the server so the modal always
  // shows the authoritative line items regardless of local state.
  useEffect(() => {
    if (isEditMode) return;
    fetch(`${API_BASE}/api/quotes/${encodeURIComponent(quote.meta.id)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { quote?: Quote } | null) => {
        if (d?.quote) {
          setServerQuote(d.quote);
          // Re-seed amendedQty from the server groups so every item is present
          const map: Record<string, number> = {};
          for (const g of (d.quote.groups ?? [])) {
            const items = Array.isArray(g.lineItems) ? g.lineItems : [];
            for (const li of items) {
              if (li && li.id) map[li.id] = li.quantity ?? 0;
            }
          }
          setAmendedQty(map);
        }
      })
      .catch(() => { /* network error — fall back to prop */ })
      .finally(() => setLoadingQuote(false));
  }, [isEditMode, quote.meta.id]);

  // Fetch existing amendment count to build the suggested quote number
  useEffect(() => {
    if (isEditMode) return;
    fetch(`${API_BASE}/api/amendments?originalQuoteId=${encodeURIComponent(quote.meta.id)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d: { amendments?: unknown[] }) => {
        const nextNum = (d.amendments?.length ?? 0) + 1;
        const padded = String(nextNum).padStart(3, "0");
        const origBase = (quote.meta.quoteNumber?.trim() || quote.meta.id).replace(/^[Qq]-?/, "");
        setQuoteNumber(`AQ-${origBase}_${padded}`);
      })
      .catch(() => {
        const origBase = (quote.meta.quoteNumber?.trim() || quote.meta.id).replace(/^[Qq]-?/, "");
        setQuoteNumber(`AQ-${origBase}_001`);
      })
      .finally(() => setLoadingCount(false));
  }, [isEditMode, quote.meta.id, quote.meta.quoteNumber]);

  // Delta calculations — recomputed whenever amendedQty changes
  const deltaSummary = useMemo(() => {
    let subtotalDelta = 0;
    const deltaGroups = activeQuote.groups
      .filter((g) => Array.isArray(g.lineItems) && g.lineItems.filter(Boolean).length > 0)
      .map((g) => ({
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        lineItems: (Array.isArray(g.lineItems) ? g.lineItems : []).filter(Boolean).map((li) => {
          const oQty = li.quantity;
          const aQty = amendedQty[li.id] ?? li.quantity;
          const delta = aQty - oQty;
          const originalValue = computeLineItemTotal(li.productId, li.unitPrice, oQty, tieredAdditionalPrice);
          const amendedValue = computeLineItemTotal(li.productId, li.unitPrice, aQty, tieredAdditionalPrice);
          const deltaValue = amendedValue - originalValue;
          subtotalDelta += deltaValue;
          return {
            productId: li.productId,
            productName: li.productName,
            unitPrice: li.unitPrice,
            originalQty: oQty,
            amendedQty: aQty,
            delta,
            originalValue,
            amendedValue,
            deltaValue,
          };
        }),
      }));

    const discount = activeQuote.meta.discount ?? 0;
    const tax = activeQuote.meta.tax ?? 0;
    const afterDiscount = subtotalDelta * (1 - discount / 100);
    const mrrDelta = afterDiscount * (1 + tax / 100);
    return { deltaGroups, subtotalDelta, mrrDelta };
  }, [activeQuote, amendedQty, tieredAdditionalPrice]);

  const hasAnyDelta = deltaSummary.deltaGroups.some((g) => g.lineItems.some((li) => li.delta !== 0));

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      let res: Response;

      const addrPayload = {
        addressNumber: quote.meta.addressNumber ?? "",
        addressName: quote.meta.addressName ?? "",
        addressCity: quote.meta.addressCity ?? "",
        addressState: quote.meta.addressState ?? "",
        zipCode: quote.meta.zipCode ?? "",
        addressCountry: quote.meta.addressCountry ?? "",
      };

      if (isEditMode && editAmendmentId) {
        res = await fetch(`${API_BASE}/api/amendments/${editAmendmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            quoteNumber: quoteNumber.trim(),
            notes,
            deltaGroups: deltaSummary.deltaGroups,
            subtotalDelta: deltaSummary.subtotalDelta,
            mrrDelta: deltaSummary.mrrDelta,
            discount: quote.meta.discount ?? 0,
            tax: quote.meta.tax ?? 0,
            ...addrPayload,
          }),
        });
      } else {
        res = await fetch(`${API_BASE}/api/amendments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: generateId(),
            originalQuoteId: quote.meta.id,
            originalQuoteNumber: quote.meta.quoteNumber ?? "",
            quoteNumber: quoteNumber.trim(),
            companyName: quote.meta.companyName ?? "",
            customerName: quote.meta.customerName ?? "",
            deltaGroups: deltaSummary.deltaGroups,
            subtotalDelta: deltaSummary.subtotalDelta,
            mrrDelta: deltaSummary.mrrDelta,
            discount: quote.meta.discount ?? 0,
            tax: quote.meta.tax ?? 0,
            notes,
            ...addrPayload,
          }),
        });
      }

      const d = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // In edit mode show only groups/items that carry a qty change (consistent with the view modal).
  // In create mode show ALL groups from the server-fetched quote so no items are ever hidden.
  const visibleGroups = isEditMode
    ? activeQuote.groups
        .map((g) => ({
          ...g,
          lineItems: (Array.isArray(g.lineItems) ? g.lineItems : []).filter(
            (li) => li && (amendedQty[li.id] ?? li.quantity) !== li.quantity,
          ),
        }))
        .filter((g) => g.lineItems.length > 0)
    : activeQuote.groups.filter((g) => Array.isArray(g.lineItems) && g.lineItems.filter(Boolean).length > 0);

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="amend-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="amend-modal-header">
          <div>
            <h2 className="amend-modal-title">
              {isEditMode
                ? `Edit Amendment ${editAmendmentNumber !== undefined ? String(editAmendmentNumber).padStart(3, "0") : ""}`
                : "Create Amendment"}
            </h2>
            <p className="amend-modal-sub">
              Original: <strong>{quote.meta.quoteNumber || "Untitled"}</strong>
              {quote.meta.companyName ? ` · ${quote.meta.companyName}` : ""}
            </p>
          </div>
          <button className="edit-modal-close" type="button" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="amend-modal-body">
          {loadingQuote && (
            <p style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              Loading quote items…
            </p>
          )}
          {!loadingQuote && !isEditMode && visibleGroups.length === 0 && (
            <p style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              No products found on this quote. Add products first.
            </p>
          )}
          <div className="amend-field-row">
            <label className="lib-label" style={{ flex: 1 }}>
              Amendment Quote Number
              <input
                className="lib-input"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                placeholder="Q-1234_Amend_001"
                disabled={loadingCount}
              />
            </label>
          </div>

          {visibleGroups.map((group) => (
            <div key={group.id} className="amend-group">
              <div className="amend-group-title">{group.categoryName}</div>
              <div className="amend-table-wrap">
                <table className="amend-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="amend-th-num">Unit Price</th>
                      <th className="amend-th-num">Orig. Qty</th>
                      <th className="amend-th-num">New Qty</th>
                      <th className="amend-th-num">Change</th>
                      <th className="amend-th-num">Delta Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(group.lineItems) ? group.lineItems : []).filter(Boolean).map((li) => {
                      const oQty = li.quantity;
                      const aQty = amendedQty[li.id] ?? li.quantity;
                      const delta = aQty - oQty;
                      const origVal = computeLineItemTotal(li.productId, li.unitPrice, oQty, tieredAdditionalPrice);
                      const amendVal = computeLineItemTotal(li.productId, li.unitPrice, aQty, tieredAdditionalPrice);
                      const deltaValue = amendVal - origVal;
                      return (
                        <tr key={li.id} className={delta !== 0 ? "amend-row-changed" : ""}>
                          <td className="amend-td-name">{li.productName}</td>
                          <td className="amend-td-num">{formatCurrency(li.unitPrice)}</td>
                          <td className="amend-td-num">{oQty}</td>
                          <td className="amend-td-qty">
                            <input
                              type="number"
                              className="amend-qty-input"
                              value={aQty}
                              min={0}
                              step={1}
                              onChange={(e) => {
                                const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                                setAmendedQty((prev) => ({ ...prev, [li.id]: v }));
                              }}
                            />
                          </td>
                          <td className="amend-td-num">
                            {delta === 0 ? (
                              <span className="amend-delta-neutral">—</span>
                            ) : delta > 0 ? (
                              <span className="amend-delta-pos amend-delta-bold">+{delta}</span>
                            ) : (
                              <span className="amend-delta-neg amend-delta-bold">{delta}</span>
                            )}
                          </td>
                          <td className="amend-td-num">
                            {delta === 0 ? (
                              <span className="amend-delta-neutral">—</span>
                            ) : (
                              <span className={`amend-delta-bold ${delta > 0 ? "amend-delta-pos" : "amend-delta-neg"}`}>
                                {delta > 0 ? "+" : ""}
                                {formatCurrency(deltaValue)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="amend-field-row" style={{ marginTop: 4 }}>
            <label className="lib-label" style={{ flex: 1 }}>
              Notes
              <textarea
                className="lib-input lib-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Reason for amendment, additional context…"
              />
            </label>
          </div>
        </div>

        {/* ── Delta summary bar ── */}
        <div className="amend-summary-bar">
          <div className="amend-summary-item">
            <span className="amend-summary-label">Subtotal Delta</span>
            <span className={`amend-summary-value ${deltaSummary.subtotalDelta > 0 ? "amend-delta-pos" : deltaSummary.subtotalDelta < 0 ? "amend-delta-neg" : "amend-delta-neutral"}`}>
              {deltaSummary.subtotalDelta === 0 ? "—" : `${deltaSummary.subtotalDelta > 0 ? "+" : ""}${formatCurrency(deltaSummary.subtotalDelta)}`}
            </span>
          </div>
          <div className="amend-summary-sep" />
          <div className="amend-summary-item">
            <span className="amend-summary-label">MRR Delta</span>
            <span className={`amend-summary-value amend-summary-mrr ${deltaSummary.mrrDelta > 0 ? "amend-delta-pos" : deltaSummary.mrrDelta < 0 ? "amend-delta-neg" : "amend-delta-neutral"}`}>
              {deltaSummary.mrrDelta === 0 ? "—" : `${deltaSummary.mrrDelta > 0 ? "+" : ""}${formatCurrency(deltaSummary.mrrDelta)}`}
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="amend-modal-footer">
          {error && <div className="edit-modal-error" style={{ marginBottom: 8 }}>{error}</div>}
          {!hasAnyDelta && !error && (
            <p className="amend-no-delta-hint">Adjust at least one quantity to {isEditMode ? "save changes" : "create an amendment"}.</p>
          )}
          <div className="amend-footer-actions">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="edit-modal-save"
              onClick={handleSave}
              disabled={saving || !hasAnyDelta || loadingCount || loadingQuote}
            >
              {saving ? "Saving…" : isEditMode ? "Save Changes" : "Create Amendment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
