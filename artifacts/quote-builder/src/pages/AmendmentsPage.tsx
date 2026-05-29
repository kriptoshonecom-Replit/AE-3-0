import { useState, useEffect, useCallback, useMemo } from "react";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { formatCurrency } from "../utils/calculations";
import AmendModal, { type AddedItem } from "../components/AmendModal";
import AmendViewModal from "../components/AmendViewModal";
import { useAuth } from "@/context/AuthContext";
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
  mcn?: string;
  addressLine?: string;
  addressNumber?: string;
  addressName?: string;
  addressCity?: string;
  addressState?: string;
  zipCode?: string;
  addressCountry?: string;
  sameForBilling?: boolean;
  billingAddressLine?: string;
  billingAddressNumber?: string;
  billingAddressName?: string;
  billingAddressCity?: string;
  billingAddressState?: string;
  billingZipCode?: string;
  billingAddressCountry?: string;
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
  creatorName?: string | null;
  creatorEmail?: string | null;
}

interface EditModeState {
  row: AmendmentRow;
  quote: Quote;
  initialAmendedQty: Record<string, number>;
  initialAdditions: AddedItem[];
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
  const initialAdditions: AddedItem[] = [];

  // Separate qty-change items (originalQty > 0) from net-new additions (originalQty === 0)
  const groups = deltaGroups
    .map((dg, gi) => ({
      id: `edit-g-${gi}`,
      categoryId: dg.categoryId,
      categoryName: dg.categoryName,
      isOpen: true,
      lineItems: dg.lineItems
        .filter((li) => li.originalQty > 0)
        .map((li, lii) => {
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
    }))
    .filter((g) => g.lineItems.length > 0);

  // Restore net-new additions
  for (const dg of deltaGroups) {
    for (const li of dg.lineItems) {
      if (li.originalQty === 0 && li.amendedQty > 0) {
        initialAdditions.push({
          id: `init-add-${initialAdditions.length}`,
          productId: li.productId,
          productName: li.productName,
          categoryId: dg.categoryId,
          categoryName: dg.categoryName,
          unitPrice: li.unitPrice,
          qty: li.amendedQty,
        });
      }
    }
  }

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
      addressLine: (d["addressLine"] as string) ?? "",
      addressNumber: (d["addressNumber"] as string) ?? "",
      addressName: (d["addressName"] as string) ?? "",
      addressCity: (d["addressCity"] as string) ?? "",
      addressState: (d["addressState"] as string) ?? "",
      zipCode: (d["zipCode"] as string) ?? "",
      addressCountry: (d["addressCountry"] as string) ?? "",
    },
    groups,
  };

  return { row, quote, initialAmendedQty, initialAdditions };
}

/* ── Main Page ────────────────────────────────────────────── */
export default function AmendmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [amendments, setAmendments] = useState<AmendmentRow[]>([]);
  const [quotesMap, setQuotesMap] = useState<Map<string, Quote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editState, setEditState] = useState<EditModeState | null>(null);
  const [viewRow, setViewRow] = useState<AmendmentRow | null>(null);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const amendEndpoint = isAdmin ? `${API_BASE}/api/admin/amendments` : `${API_BASE}/api/amendments`;
      const quotesEndpoint = isAdmin ? `${API_BASE}/api/admin/quotes` : `${API_BASE}/api/quotes`;
      const [amendRes, quotesRes] = await Promise.all([
        fetch(amendEndpoint, { credentials: "include" }),
        fetch(quotesEndpoint, { credentials: "include" }),
      ]);
      if (!amendRes.ok) {
        const d = (await amendRes.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to load");
      }
      const data = (await amendRes.json()) as { amendments: AmendmentRow[] };
      setAmendments([...data.amendments].reverse());
      if (quotesRes.ok) {
        const qd = isAdmin
          ? (await quotesRes.json()) as { quotes: { id: string; data: Quote }[] }
          : (await quotesRes.json()) as { quotes: Quote[] };
        const map = new Map<string, Quote>();
        if (isAdmin) {
          for (const r of (qd as { quotes: { id: string; data: Quote }[] }).quotes ?? []) {
            if (r.id) map.set(r.id, r.data);
            if (r.data?.meta?.id) map.set(r.data.meta.id, r.data);
          }
        } else {
          for (const q of (qd as { quotes: Quote[] }).quotes ?? []) {
            if (q.meta?.id) map.set(q.meta.id, q);
          }
        }
        setQuotesMap(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

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
        mcn: m.mcn ?? "",
        addressLine: m.addressLine ?? "",
        addressNumber: m.addressNumber ?? "",
        addressName: m.addressName ?? "",
        addressCity: m.addressCity ?? "",
        addressState: m.addressState ?? "",
        zipCode: m.zipCode ?? "",
        addressCountry: m.addressCountry ?? "",
        sameForBilling: m.sameForBilling ?? true,
        billingAddressLine: m.billingAddressLine ?? "",
        billingAddressNumber: m.billingAddressNumber ?? "",
        billingAddressName: m.billingAddressName ?? "",
        billingAddressCity: m.billingAddressCity ?? "",
        billingAddressState: m.billingAddressState ?? "",
        billingZipCode: m.billingZipCode ?? "",
        billingAddressCountry: m.billingAddressCountry ?? "",
      },
    };
  }

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(id: string) {
    if (!window.confirm("Permanently delete this amendment?")) return;
    try {
      const url = isAdmin
        ? `${API_BASE}/api/admin/amendments/${id}`
        : `${API_BASE}/api/amendments/${id}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
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
    return [row.quoteNumber, row.originalQuoteNumber, row.companyName, row.customerName, row.creatorName, row.creatorEmail].some((v) =>
      v?.toLowerCase().includes(s)
    );
  });

  const groups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      originalQuoteNumber: string | null;
      companyName: string | null;
      rows: AmendmentRow[];
    }>();
    for (const row of filtered) {
      const key = row.originalQuoteNumber || row.originalQuoteId;
      if (!map.has(key)) {
        map.set(key, { key, originalQuoteNumber: row.originalQuoteNumber, companyName: row.companyName, rows: [] });
      }
      map.get(key)!.rows.push(row);
    }
    return [...map.values()];
  }, [filtered]);

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
          <div className="amend-accordion-list">
            {groups.length === 0 && (
              <div className="admin-table-empty" style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                {search
                  ? `No amendments match "${search}"`
                  : "No amendments yet — open a quote with PASS status in the builder and click Amend."}
              </div>
            )}

            {groups.map((group) => {
              const isOpen = !closedGroups.has(group.key);
              const totalMrr = group.rows.reduce((sum, r) => sum + (r.data?.mrrDelta ?? 0), 0);
              const mrrColor = totalMrr > 0 ? "var(--green, #15803d)" : totalMrr < 0 ? "var(--red, #b91c1c)" : "var(--text-3)";

              return (
                <div key={group.key} className="amend-accordion">
                  {/* ── Accordion header ── */}
                  <button
                    type="button"
                    className="amend-accordion-header"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={isOpen}
                  >
                    <svg
                      className={`amend-accordion-chevron${isOpen ? " open" : ""}`}
                      width="14" height="14" viewBox="0 0 16 16" fill="none"
                    >
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    <span className="amend-accordion-title">
                      {group.originalQuoteNumber || <span style={{ color: "var(--text-3)", fontWeight: 400 }}>No quote number</span>}
                    </span>

                    {group.companyName && (
                      <span className="amend-accordion-company">· {group.companyName}</span>
                    )}

                    <span className="amend-accordion-meta">
                      <span className="amend-accordion-count">
                        {group.rows.length} amendment{group.rows.length !== 1 ? "s" : ""}
                      </span>
                      {totalMrr !== 0 && (
                        <span className="amend-accordion-mrr" style={{ color: mrrColor }}>
                          {totalMrr > 0 ? "+" : ""}{formatCurrency(totalMrr)} MRR
                        </span>
                      )}
                    </span>
                  </button>

                  {/* ── Accordion body ── */}
                  {isOpen && (
                    <div className="amend-accordion-body">
                      <div className="admin-table-wrap" style={{ borderRadius: 0, border: "none" }}>
                        <table className="admin-table" style={{ borderRadius: 0 }}>
                          <thead>
                            <tr>
                              <th>Amendment #</th>
                              <th>Quote #</th>
                              <th>Customer</th>
                              {isAdmin && <th>Creator</th>}
                              <th>Created</th>
                              <th style={{ textAlign: "right" }}>MRR Delta</th>
                              <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => (
                              <tr key={row.id}>
                                <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-2)" }}>
                                  {fmtAmendNum(row.amendmentNumber)}
                                </td>
                                <td className="admin-td-bold" style={{ fontFamily: "monospace", fontSize: 12 }}>
                                  {row.quoteNumber || <span style={{ color: "var(--text-3)" }}>Untitled</span>}
                                </td>
                                <td>{row.customerName || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                                {isAdmin && (
                                  <td>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                      <span style={{ fontWeight: 500 }}>{row.creatorName || "—"}</span>
                                      {row.creatorEmail && (
                                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{row.creatorEmail}</span>
                                      )}
                                    </div>
                                  </td>
                                )}
                                <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--text-2)" }}>
                                  {fmtDate(row.createdAt)}
                                </td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                  <MrrDeltaBadge value={row.data?.mrrDelta} />
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
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
                    </div>
                  )}
                </div>
              );
            })}
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
          initialAdditions={editState.initialAdditions}
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
