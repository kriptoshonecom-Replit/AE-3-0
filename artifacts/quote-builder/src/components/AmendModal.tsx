import { useState, useEffect, useMemo } from "react";
import type { Quote } from "../types";
import { X, Plus } from "lucide-react";
import { computeLineItemTotal } from "../utils/quoteLogic";
import { formatCurrency, generateId } from "../utils/calculations";
import productsData from "../data/products.json";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface AddedItem {
  id: string;
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  unitPrice: number;
  qty: number;
}

interface AmendModalProps {
  quote: Quote;
  tieredAdditionalPrice: number;
  rfByProductId?: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
  editAmendmentId?: string;
  editAmendmentNumber?: number;
  initialAmendedQty?: Record<string, number>;
  initialAdditions?: AddedItem[];
  initialQuoteNumber?: string;
  initialNotes?: string;
}

export default function AmendModal({
  quote,
  tieredAdditionalPrice,
  rfByProductId = {},
  onClose,
  onSaved,
  editAmendmentId,
  editAmendmentNumber,
  initialAmendedQty,
  initialAdditions,
  initialQuoteNumber,
  initialNotes,
}: AmendModalProps) {
  const isEditMode = Boolean(editAmendmentId);

  const [quoteNumber, setQuoteNumber] = useState(initialQuoteNumber ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [loadingCount, setLoadingCount] = useState(!isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Existing product qty overrides (keyed by line item id)
  const [amendedQty, setAmendedQty] = useState<Record<string, number>>(() => {
    if (initialAmendedQty) return { ...initialAmendedQty };
    const map: Record<string, number> = {};
    for (const g of quote.groups) {
      for (const li of (Array.isArray(g.lineItems) ? g.lineItems : []).filter(Boolean)) {
        if (li?.id) map[li.id] = li.quantity ?? 0;
      }
    }
    return map;
  });

  // New product additions
  const [addedItems, setAddedItems] = useState<AddedItem[]>(() => initialAdditions ?? []);

  // Product picker state
  const [pickerCategoryId, setPickerCategoryId] = useState("");
  const [pickerProductId, setPickerProductId] = useState("");
  const [pickerQty, setPickerQty] = useState(1);
  const [pickerPrice, setPickerPrice] = useState<number | "">(0);

  const pickerCategory = productsData.categories.find((c) => c.id === pickerCategoryId);
  const pickerProduct = pickerCategory?.items.find((i) => i.id === pickerProductId);

  // Auto-fill price when product selected
  useEffect(() => {
    if (pickerProduct) setPickerPrice(pickerProduct.price);
    else setPickerPrice(0);
  }, [pickerProduct]);

  // Reset product when category changes
  useEffect(() => {
    setPickerProductId("");
  }, [pickerCategoryId]);

  // Build suggested quote number in create mode
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

  // Delta calculations — existing items + new additions
  const deltaSummary = useMemo(() => {
    let subtotalDelta = 0;
    let restockingFee = 0;

    // Map to merge additions into their category groups
    const groupMap = new Map<string, {
      categoryId: string;
      categoryName: string;
      lineItems: {
        productId: string; productName: string; unitPrice: number;
        originalQty: number; amendedQty: number; delta: number;
        originalValue: number; amendedValue: number; deltaValue: number;
      }[];
    }>();

    // Existing quote products
    for (const g of quote.groups.filter(
      (g) => Array.isArray(g.lineItems) && g.lineItems.filter(Boolean).length > 0,
    )) {
      const groupItems = (Array.isArray(g.lineItems) ? g.lineItems : []).filter(Boolean).map((li) => {
        const oQty = li.quantity;
        const aQty = amendedQty[li.id] ?? li.quantity;
        const delta = aQty - oQty;
        const originalValue = computeLineItemTotal(li.productId, li.unitPrice, oQty, tieredAdditionalPrice);
        const amendedValue = computeLineItemTotal(li.productId, li.unitPrice, aQty, tieredAdditionalPrice);
        const deltaValue = amendedValue - originalValue;
        subtotalDelta += deltaValue;
        if (delta < 0) {
          restockingFee += Math.abs(delta) * (rfByProductId[li.productId] ?? 0);
        }
        return {
          productId: li.productId, productName: li.productName, unitPrice: li.unitPrice,
          originalQty: oQty, amendedQty: aQty, delta, originalValue, amendedValue, deltaValue,
        };
      });
      groupMap.set(g.categoryId, { categoryId: g.categoryId, categoryName: g.categoryName, lineItems: groupItems });
    }

    // New product additions — originalQty is always 0
    for (const added of addedItems) {
      const addedValue = computeLineItemTotal(added.productId, added.unitPrice, added.qty, tieredAdditionalPrice);
      subtotalDelta += addedValue;
      const addedLineItem = {
        productId: added.productId, productName: added.productName, unitPrice: added.unitPrice,
        originalQty: 0, amendedQty: added.qty, delta: added.qty,
        originalValue: 0, amendedValue: addedValue, deltaValue: addedValue,
      };
      const existing = groupMap.get(added.categoryId);
      if (existing) {
        existing.lineItems.push(addedLineItem);
      } else {
        groupMap.set(added.categoryId, {
          categoryId: added.categoryId, categoryName: added.categoryName, lineItems: [addedLineItem],
        });
      }
    }

    const deltaGroups = Array.from(groupMap.values());
    const discount = quote.meta.discount ?? 0;
    const tax = quote.meta.tax ?? 0;
    const afterDiscount = subtotalDelta * (1 - discount / 100);
    const mrrDelta = afterDiscount * (1 + tax / 100);
    return { deltaGroups, subtotalDelta, mrrDelta, restockingFee };
  }, [quote, amendedQty, addedItems, tieredAdditionalPrice, rfByProductId]);

  const hasAnyDelta =
    deltaSummary.deltaGroups.some((g) => g.lineItems.some((li) => li.delta !== 0)) ||
    addedItems.length > 0;

  function handleAddProduct() {
    if (!pickerProduct || !pickerCategory || pickerQty < 1) return;
    const price = typeof pickerPrice === "number" && pickerPrice >= 0 ? pickerPrice : pickerProduct.price;
    setAddedItems((prev) => [
      ...prev,
      {
        id: generateId(),
        productId: pickerProduct.id,
        productName: pickerProduct.name,
        categoryId: pickerCategory.id,
        categoryName: pickerCategory.name,
        unitPrice: price,
        qty: pickerQty,
      },
    ]);
    setPickerProductId("");
    setPickerQty(1);
    setPickerPrice(0);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const addrPayload = {
        addressLine: quote.meta.addressLine ?? "",
        addressNumber: quote.meta.addressNumber ?? "",
        addressName: quote.meta.addressName ?? "",
        addressCity: quote.meta.addressCity ?? "",
        addressState: quote.meta.addressState ?? "",
        zipCode: quote.meta.zipCode ?? "",
        addressCountry: quote.meta.addressCountry ?? "",
      };

      let res: Response;
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
            restockingFee: deltaSummary.restockingFee,
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
            restockingFee: deltaSummary.restockingFee,
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

  // In edit mode only show rows with a qty change; in create mode show all
  const visibleGroups = isEditMode
    ? quote.groups
        .map((g) => ({
          ...g,
          lineItems: (Array.isArray(g.lineItems) ? g.lineItems : []).filter(
            (li) => li && (amendedQty[li.id] ?? li.quantity) !== li.quantity,
          ),
        }))
        .filter((g) => g.lineItems.length > 0)
    : quote.groups.filter((g) => Array.isArray(g.lineItems) && g.lineItems.filter(Boolean).length > 0);

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="amend-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
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
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="amend-modal-body">
          {!isEditMode && visibleGroups.length === 0 && addedItems.length === 0 && (
            <p style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "16px 0 0" }}>
              No products on this quote yet. Use the section below to add new products.
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

          {/* Existing products — quantity changes */}
          {visibleGroups.length > 0 && (
            <div className="amend-section-label">Quantity Changes</div>
          )}
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
                                {delta > 0 ? "+" : ""}{formatCurrency(deltaValue)}
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

          {/* ── New Product Additions ── */}
          <div className="amend-additions-section">
            <div className="amend-section-label" style={{ marginBottom: 10 }}>
              New Product Additions
            </div>

            {/* Picker row */}
            <div className="amend-picker-row">
              <select
                className="amend-picker-select"
                value={pickerCategoryId}
                onChange={(e) => setPickerCategoryId(e.target.value)}
              >
                <option value="">Category…</option>
                {productsData.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                className="amend-picker-select"
                value={pickerProductId}
                onChange={(e) => setPickerProductId(e.target.value)}
                disabled={!pickerCategoryId}
              >
                <option value="">Product…</option>
                {(pickerCategory?.items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>

              <input
                type="number"
                className="amend-picker-num"
                value={pickerQty}
                min={1}
                step={1}
                title="Quantity"
                placeholder="Qty"
                onChange={(e) => setPickerQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              />

              <input
                type="number"
                className="amend-picker-num amend-picker-price"
                value={pickerPrice}
                min={0}
                step={0.01}
                title="Unit price"
                placeholder="Price"
                onChange={(e) => setPickerPrice(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
              />

              <button
                type="button"
                className="amend-picker-add-btn"
                onClick={handleAddProduct}
                disabled={!pickerProductId || pickerQty < 1}
                title="Add product to amendment"
              >
                <Plus size={12} />
                Add
              </button>
            </div>

            {/* Added items list */}
            {addedItems.length > 0 && (
              <div className="amend-table-wrap" style={{ marginTop: 8 }}>
                <table className="amend-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th className="amend-th-num">Unit Price</th>
                      <th className="amend-th-num">Qty</th>
                      <th className="amend-th-num">Value</th>
                      <th className="amend-th-num" style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {addedItems.map((item) => {
                      const val = computeLineItemTotal(item.productId, item.unitPrice, item.qty, tieredAdditionalPrice);
                      return (
                        <tr key={item.id} className="amend-row-changed">
                          <td className="amend-td-name">
                            <span className="amend-badge-new">NEW</span>
                            {item.productName}
                          </td>
                          <td className="amend-td-name" style={{ color: "var(--text-3)", fontSize: 12 }}>{item.categoryName}</td>
                          <td className="amend-td-num">{formatCurrency(item.unitPrice)}</td>
                          <td className="amend-td-num">{item.qty}</td>
                          <td className="amend-td-num amend-delta-pos amend-delta-bold">
                            +{formatCurrency(val)}
                          </td>
                          <td className="amend-td-num">
                            <button
                              type="button"
                              className="amend-remove-btn"
                              onClick={() => setAddedItems((prev) => prev.filter((i) => i.id !== item.id))}
                              title="Remove"
                            >
                              <X size={10} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {addedItems.length === 0 && (
              <p className="amend-additions-hint">
                Select a category and product above to add items not in the original quote.
              </p>
            )}
          </div>

          {/* Notes */}
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

        {/* Delta summary bar */}
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
          {deltaSummary.restockingFee > 0 && (
            <>
              <div className="amend-summary-sep" />
              <div className="amend-summary-item">
                <span className="amend-summary-label">Restocking Fee</span>
                <span className="amend-summary-value amend-delta-neg amend-delta-bold">
                  {formatCurrency(deltaSummary.restockingFee)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="amend-modal-footer">
          {error && <div className="edit-modal-error" style={{ marginBottom: 8 }}>{error}</div>}
          {!hasAnyDelta && !error && (
            <p className="amend-no-delta-hint">
              Adjust at least one quantity or add a new product to {isEditMode ? "save changes" : "create an amendment"}.
            </p>
          )}
          <div className="amend-footer-actions">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="edit-modal-save"
              onClick={handleSave}
              disabled={saving || !hasAnyDelta || loadingCount}
            >
              {saving ? "Saving…" : isEditMode ? "Save Changes" : "Create Amendment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
