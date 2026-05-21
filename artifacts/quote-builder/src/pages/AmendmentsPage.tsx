import { useState, useEffect, useCallback } from "react";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { formatCurrency } from "../utils/calculations";
import AmendModal from "../components/AmendModal";
import AmendViewModal from "../components/AmendViewModal";
import type { Quote } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TIERED_ADDITIONAL_PRICE = 30;

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

interface AmendmentData {
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

interface AmendmentRow {
  id: string;
  originalQuoteId: string;
  originalQuoteNumber: string | null;
  quoteNumber: string | null;
  amendmentNumber: number;
  companyName: string | null;
  customerName: string | null;
  data: AmendmentData;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface EditModeState {
  row: AmendmentRow;
  quote: Quote;
  initialAmendedQty: Record<string, number>;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAmendNum(n: number) {
  return `Amend ${String(n).padStart(3, "0")}`;
}

function MrrDeltaBadge({ value }: { value: number | undefined }) {
  if (value === undefined || value === null || value === 0) {
    return <span style={{ color: "var(--text-3)" }}>—</span>;
  }
  const cls = value > 0 ? "amend-delta-pos" : "amend-delta-neg";
  return (
    <span className={cls} style={{ fontWeight: 600 }}>
      {value > 0 ? "+" : ""}{formatCurrency(value)}
    </span>
  );
}

/** Reconstruct a Quote-like object from amendment data so AmendModal can operate on it */
function buildEditState(row: AmendmentRow): EditModeState {
  const deltaGroups = row.data?.deltaGroups ?? [];
  const initialAmendedQty: Record<string, number> = {};

  const groups = deltaGroups.map((dg, gi) => ({
    id: `edit-g-${gi}`,
    categoryId: dg.categoryId,
    categoryName: dg.categoryName,
    isOpen: true,
    lineItems: dg.lineItems.map((li, lii) => {
      const id = `edit-li-${gi}-${lii}`;
      initialAmendedQty[id] = li.amendedQty;
      return {
        id,
        productId: li.productId,
        productName: li.productName,
        unitPrice: li.unitPrice,
        quantity: li.originalQty,
      };
    }),
  }));

  const d = row.data as Record<string, unknown> ?? {};
  const quote: Quote = {
    meta: {
      id: row.originalQuoteId,
      quoteNumber: row.originalQuoteNumber ?? "",
      oppNumber: "",
      salesRep: "",
      companyName: row.companyName ?? "",
      customerName: row.customerName ?? "",
      customerEmail: "",
      validUntil: "",
      notes: "",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      discount: (d["discount"] as number) ?? 0,
      tax: (d["tax"] as number) ?? 0,
      passStatus: "pass",
      addressNumber: (d["addressNumber"] as string) ?? "",
      addressName: (d["addressName"] as string) ?? "",
      addressCity: (d["addressCity"] as string) ?? "",
      addressState: (d["addressState"] as string) ?? "",
      zipCode: (d["zipCode"] as string) ?? "",
      addressCountry: (d["addressCountry"] as string) ?? "",
    },
    groups,
  };

  return { row, quote, initialAmendedQty };
}

/* ── Main Page ────────────────────────────────────────────── */
export default function AmendmentsPage() {
  const [amendments, setAmendments] = useState<AmendmentRow[]>([]);
  const [quotesMap, setQuotesMap] = useState<Map<string, Quote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editState, setEditState] = useState<EditModeState | null>(null);
  const [viewRow, setViewRow] = useState<AmendmentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [amendRes, quotesRes] = await Promise.all([
        fetch(`${API_BASE}/api/amendments`, { credentials: "include" }),
        fetch(`${API_BASE}/api/quotes`, { credentials: "include" }),
      ]);
      if (!amendRes.ok) {
        const d = (await amendRes.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to load");
      }
      const data = (await amendRes.json()) as { amendments: AmendmentRow[] };
      setAmendments([...data.amendments].reverse());
      if (quotesRes.ok) {
        const qd = (await quotesRes.json()) as { quotes: Quote[] };
        const map = new Map<string, Quote>();
        for (const q of qd.quotes ?? []) {
          if (q.meta?.id) map.set(q.meta.id, q);
        }
        setQuotesMap(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Fill in address from the original quote when the amendment's stored address is blank */
  function augmentRowWithAddress(row: AmendmentRow): AmendmentRow {
    const d = row.data ?? {};
    const hasAddr = [d.addressNumber, d.addressName, d.addressCity, d.addressState, d.zipCode]
      .some((v) => v && v.trim() !== "");
    if (hasAddr) return row;
    const origQuote = quotesMap.get(row.originalQuoteId);
    if (!origQuote?.meta) return row;
    const m = origQuote.meta;
    return {
      ...row,
      data: {
        ...d,
        addressNumber: m.addressNumber ?? "",
        addressName: m.addressName ?? "",
        addressCity: m.addressCity ?? "",
        addressState: m.addressState ?? "",
        zipCode: m.zipCode ?? "",
        addressCountry: m.addressCountry ?? "",
      },
    };
  }

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(id: string) {
    if (!window.confirm("Permanently delete this amendment?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/amendments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Delete failed");
      }
      setAmendments((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const filtered = amendments.filter((row) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [row.quoteNumber, row.originalQuoteNumber, row.companyName, row.customerName].some((v) =>
      v?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">Amendments</h1>
        <div className="admin-topbar-right">
          <span className="admin-badge">
            {amendments.length} amendment{amendments.length !== 1 ? "s" : ""}
          </span>
          <button
            className="admin-btn-add-secondary"
            onClick={() => void load()}
            disabled={loading}
            title="Reload amendments"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 4 }}>
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2M13.5 2v3.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-toolbar">
          <div className="ql-search-wrap admin-search" style={{ maxWidth: 320 }}>
            <svg className="ql-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className="ql-search"
              placeholder="Search quote number, company, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="ql-search-clear" onClick={() => setSearch("")}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {loading && <div className="admin-loading"><div className="spinner" /></div>}
        {!loading && error && <div className="edit-modal-error">{error}</div>}

        {!loading && !error && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Amendment #</th>
                  <th>Quote #</th>
                  <th>Original Quote</th>
                  <th>Company</th>
                  <th>Customer</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>MRR Delta</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="admin-table-empty">
                      {search
                        ? `No amendments match "${search}"`
                        : "No amendments yet — open a quote with PASS status in the builder and click Amend."}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-2)" }}>
                      {fmtAmendNum(row.amendmentNumber)}
                    </td>
                    <td className="admin-td-bold" style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {row.quoteNumber || <span style={{ color: "var(--text-3)" }}>Untitled</span>}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-2)" }}>
                      {row.originalQuoteNumber || <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td>{row.companyName || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                    <td>{row.customerName || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--text-2)" }}>
                      {fmtDate(row.createdAt)}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <MrrDeltaBadge value={row.data?.mrrDelta} />
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-btn-view"
                          onClick={() => setViewRow(augmentRowWithAddress(row))}
                          title="Preview amendment"
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <ellipse cx="8" cy="8" rx="6.5" ry="4.5" stroke="currentColor" strokeWidth="1.4" />
                            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                          </svg>
                          View
                        </button>
                        <button
                          type="button"
                          className="admin-btn-edit"
                          onClick={() => setEditState(buildEditState(augmentRowWithAddress(row)))}
                          title="Edit amendment"
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-btn-delete"
                          onClick={() => void handleDelete(row.id)}
                          title="Delete amendment"
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M13 4l-1 9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal — full AmendModal in edit mode */}
      {editState && (
        <AmendModal
          quote={editState.quote}
          tieredAdditionalPrice={TIERED_ADDITIONAL_PRICE}
          editAmendmentId={editState.row.id}
          editAmendmentNumber={editState.row.amendmentNumber}
          initialAmendedQty={editState.initialAmendedQty}
          initialQuoteNumber={editState.row.quoteNumber ?? ""}
          initialNotes={(editState.row.data?.notes as string) ?? ""}
          onClose={() => setEditState(null)}
          onSaved={() => {
            setEditState(null);
            void load();
          }}
        />
      )}

      {/* View modal — read-only preview */}
      {viewRow && (
        <AmendViewModal
          row={viewRow}
          onClose={() => setViewRow(null)}
        />
      )}
    </div>
  );
}
