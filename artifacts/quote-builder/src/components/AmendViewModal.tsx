import { useState } from "react";
import { formatCurrency } from "../utils/calculations";
import { exportAmendmentToPDF } from "../utils/amendmentPdfExport";

const TIERED_ADDITIONAL_UNIT_PRICE = 30;

function computeLineItemTotalLocal(productId: string, unitPrice: number, quantity: number): number {
  const TIERED_ITEM_IDS = ["co-001", "co-002"];
  if (TIERED_ITEM_IDS.includes(productId) && quantity > 0) {
    return unitPrice + Math.max(0, quantity - 1) * TIERED_ADDITIONAL_UNIT_PRICE;
  }
  return unitPrice * quantity;
}

interface DeltaLineItem {
  productId: string;
  productName: string;
  unitPrice: number;
  originalQty: number;
  amendedQty: number;
  delta: number;
  deltaValue: number;
}

interface DeltaGroup {
  categoryId: string;
  categoryName: string;
  lineItems: DeltaLineItem[];
}

interface AmendmentDataShape {
  deltaGroups?: DeltaGroup[];
  subtotalDelta?: number;
  mrrDelta?: number;
  discount?: number;
  tax?: number;
  notes?: string;
  addressNumber?: string;
  addressName?: string;
  addressCity?: string;
  addressState?: string;
  zipCode?: string;
  addressCountry?: string;
}

interface ViewRow {
  id: string;
  quoteNumber: string | null;
  originalQuoteNumber: string | null;
  amendmentNumber: number;
  companyName: string | null;
  customerName: string | null;
  data: AmendmentDataShape;
  createdAt: string;
}

interface AmendViewModalProps {
  row: ViewRow;
  onClose: () => void;
}

function fmtDate(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AmendViewModal({ row, onClose }: AmendViewModalProps) {
  const [exporting, setExporting] = useState(false);
  const data = row.data ?? {};
  const deltaGroups = (data.deltaGroups ?? []) as DeltaGroup[];
  const subtotalDelta = data.subtotalDelta ?? 0;
  const mrrDelta = data.mrrDelta ?? 0;
  const notes = data.notes ?? "";
  const amendNumStr = String(row.amendmentNumber).padStart(3, "0");
  const changedGroups = deltaGroups
    .map((g) => ({ ...g, lineItems: g.lineItems.filter((li) => li.amendedQty - li.originalQty !== 0) }))
    .filter((g) => g.lineItems.length > 0);
  const visibleGroups = deltaGroups.filter((g) => g.lineItems.length > 0);

  async function handleExport() {
    setExporting(true);
    try {
      await exportAmendmentToPDF({
        amendmentNumber: row.amendmentNumber,
        quoteNumber: row.quoteNumber,
        originalQuoteNumber: row.originalQuoteNumber,
        companyName: row.companyName,
        customerName: row.customerName,
        createdAt: row.createdAt,
        deltaGroups: changedGroups as Parameters<typeof exportAmendmentToPDF>[0]["deltaGroups"],
        subtotalDelta,
        mrrDelta,
        discount: data.discount as number | undefined,
        tax: data.tax as number | undefined,
        notes,
      });
    } finally {
      setExporting(false);
    }
  }

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
              Amendment {amendNumStr}
              {row.quoteNumber ? <span style={{ fontWeight: 400, color: "var(--text-2)", marginLeft: 8, fontSize: 13 }}>{row.quoteNumber}</span> : null}
            </h2>
            <p className="amend-modal-sub">
              Original: <strong>{row.originalQuoteNumber || "Untitled"}</strong>
              {row.companyName ? ` · ${row.companyName}` : ""}
              {row.customerName ? ` · ${row.customerName}` : ""}
              <span style={{ marginLeft: 10, color: "var(--text-3)" }}>{fmtDate(row.createdAt)}</span>
            </p>
            {(() => {
              const d = row.data ?? {};
              const street = [d.addressNumber, d.addressName].filter(Boolean).join(" ");
              const cityState = [d.addressCity, d.addressState].filter(Boolean).join(", ");
              const zip = d.zipCode;
              const country = d.addressCountry;
              const parts = [street, cityState, zip, country].filter(Boolean);
              if (parts.length === 0) return null;
              return (
                <p className="amend-modal-sub" style={{ marginTop: 2 }}>
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4, verticalAlign: "middle", opacity: 0.55 }}>
                    <path d="M7 1.5C4.79 1.5 3 3.29 3 5.5c0 3.25 4 7 4 7s4-3.75 4-7c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.3" fill="none" />
                    <circle cx="7" cy="5.5" r="1.2" fill="currentColor" />
                  </svg>
                  {parts.join(" · ")}
                </p>
              );
            })()}
          </div>
          <button className="edit-modal-close" type="button" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="amend-modal-body">
          {visibleGroups.map((group) => (
            <div key={group.categoryId} className="amend-group">
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
                    {group.lineItems.map((li, i) => {
                      const delta = li.amendedQty - li.originalQty;
                      const origVal = computeLineItemTotalLocal(li.productId, li.unitPrice, li.originalQty);
                      const amendVal = computeLineItemTotalLocal(li.productId, li.unitPrice, li.amendedQty);
                      const deltaValue = amendVal - origVal;
                      return (
                        <tr key={i} className={delta !== 0 ? "amend-row-changed" : ""}>
                          <td className="amend-td-name" style={delta === 0 ? { color: "var(--text-3)" } : undefined}>
                            {li.productName}
                          </td>
                          <td className="amend-td-num" style={delta === 0 ? { color: "var(--text-3)" } : undefined}>
                            {formatCurrency(li.unitPrice)}
                          </td>
                          <td className="amend-td-num" style={delta === 0 ? { color: "var(--text-3)" } : undefined}>
                            {li.originalQty}
                          </td>
                          <td className="amend-td-num" style={{ fontWeight: delta !== 0 ? 700 : undefined, color: delta === 0 ? "var(--text-3)" : undefined }}>
                            {li.amendedQty}
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

          {notes && (
            <div className="amend-view-notes">
              <p className="amend-view-notes-label">Notes</p>
              <p className="amend-view-notes-body">{notes}</p>
            </div>
          )}
        </div>

        {/* ── Delta summary bar ── */}
        <div className="amend-summary-bar">
          <div className="amend-summary-item">
            <span className="amend-summary-label">Subtotal Delta</span>
            <span className={`amend-summary-value ${subtotalDelta > 0 ? "amend-delta-pos" : subtotalDelta < 0 ? "amend-delta-neg" : "amend-delta-neutral"}`}>
              {subtotalDelta === 0 ? "—" : `${subtotalDelta > 0 ? "+" : ""}${formatCurrency(subtotalDelta)}`}
            </span>
          </div>
          <div className="amend-summary-sep" />
          <div className="amend-summary-item">
            <span className="amend-summary-label">MRR Delta</span>
            <span className={`amend-summary-value amend-summary-mrr ${mrrDelta > 0 ? "amend-delta-pos" : mrrDelta < 0 ? "amend-delta-neg" : "amend-delta-neutral"}`}>
              {mrrDelta === 0 ? "—" : `${mrrDelta > 0 ? "+" : ""}${formatCurrency(mrrDelta)}`}
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="amend-modal-footer">
          <div className="amend-footer-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Close</button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 6" />
                  </svg>
                  Exporting…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Export PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
