import { useState, useEffect, useCallback } from "react";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { formatCurrency } from "../utils/calculations";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface AmendmentData {
  deltaGroups?: unknown[];
  subtotalDelta?: number;
  mrrDelta?: number;
  discount?: number;
  tax?: number;
  notes?: string;
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
      {value > 0 ? "+" : ""}
      {formatCurrency(value)}
    </span>
  );
}

/* ── Edit Drawer ──────────────────────────────────────────── */
interface EditDrawerProps {
  row: AmendmentRow;
  onClose: () => void;
  onSaved: (updated: AmendmentRow) => void;
}

function EditDrawer({ row, onClose, onSaved }: EditDrawerProps) {
  const [quoteNumber, setQuoteNumber] = useState(row.quoteNumber ?? "");
  const [notes, setNotes] = useState((row.data?.notes as string) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/amendments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quoteNumber, notes }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      onSaved({
        ...row,
        quoteNumber: quoteNumber || null,
        data: { ...row.data, notes },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const deltaGroups = (row.data?.deltaGroups ?? []) as Array<{
    categoryName: string;
    lineItems: Array<{
      productName: string;
      originalQty: number;
      amendedQty: number;
      delta: number;
      deltaValue: number;
    }>;
  }>;

  const changedLines = deltaGroups.flatMap((g) =>
    g.lineItems
      .filter((li) => li.delta !== 0)
      .map((li) => ({ ...li, categoryName: g.categoryName }))
  );

  return (
    <div className="lib-drawer-backdrop" onClick={onClose}>
      <div className="lib-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="lib-drawer-header">
          <div>
            <h2 className="lib-drawer-title">Edit Amendment</h2>
            <p className="lib-drawer-sub">
              {fmtAmendNum(row.amendmentNumber)} · Original: {row.originalQuoteNumber || "Untitled"}
            </p>
          </div>
          <button type="button" className="lib-drawer-close" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="edit-modal-error" style={{ margin: "10px 24px 0" }}>
            {error}
          </div>
        )}

        {/* Delta summary */}
        {changedLines.length > 0 && (
          <div style={{ padding: "12px 24px 0" }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 8 }}>
              Changed Line Items
            </p>
            <div className="amend-drawer-delta-list">
              {changedLines.map((li, i) => (
                <div key={i} className="amend-drawer-delta-row">
                  <span className="amend-drawer-delta-name">{li.productName}</span>
                  <span className="amend-drawer-delta-qty">
                    {li.originalQty} →{" "}
                    <strong className={li.delta > 0 ? "amend-delta-pos" : "amend-delta-neg"}>
                      {li.amendedQty}
                    </strong>
                  </span>
                  <span className={li.delta > 0 ? "amend-delta-pos" : "amend-delta-neg"} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600 }}>
                    {li.delta > 0 ? "+" : ""}
                    {formatCurrency(li.deltaValue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form className="lib-drawer-form" onSubmit={handleSave}>
          <label className="lib-label">
            Amendment Quote Number
            <input
              className="lib-input"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              placeholder="Q-1234_Amend_001"
            />
          </label>
          <label className="lib-label">
            Notes
            <textarea
              className="lib-input lib-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Reason for amendment, additional context…"
            />
          </label>
          <div className="lib-drawer-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="edit-modal-save" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */
export default function AmendmentsPage() {
  const [amendments, setAmendments] = useState<AmendmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<AmendmentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/amendments`, { credentials: "include" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to load");
      }
      const data = (await res.json()) as { amendments: AmendmentRow[] };
      setAmendments([...data.amendments].reverse());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
              <path
                d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2M13.5 2v3.5H10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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

        {loading && (
          <div className="admin-loading">
            <div className="spinner" />
          </div>
        )}
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
                          className="admin-btn-edit"
                          onClick={() => setEditRow(row)}
                          title="Edit amendment"
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
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
                            <path
                              d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M13 4l-1 9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L3 4"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
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

      {editRow && (
        <EditDrawer
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={(updated) => {
            setAmendments((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setEditRow(null);
          }}
        />
      )}
    </div>
  );
}
