import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { formatCurrency, quoteTotal } from "../utils/calculations";
import { computeProductRelatedPitTotal } from "../components/ProductRelatedPitSection";
import pitData from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";
import type { Quote, QuoteMeta } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const DEFAULT_YES_NO: Record<string, boolean> = {
  "connected-payments-yn": false,
  "online-ordering-yn": false,
};
const DEFAULT_OPT_PROGRAMS: Record<string, boolean> = {
  "consumer-marketing": true,
  "insight-or-console": true,
  "aloha-api": true,
  kitchen: true,
  orderpay: true,
  "aloha-delivery": true,
};

function computeTotal(data: Quote): number {
  const pitCat = pitData.categories.find((c) => c.id === (data.meta.pitType ?? ""));
  const pitTotal = pitCat
    ? pitCat.lineItems.reduce((s, i) => s + i.duration * PIT_HOURLY_RATE, 0)
    : 0;
  const yesNoToggles = { ...DEFAULT_YES_NO, ...(data.meta.yesNoToggles ?? {}) };
  const optToggles = { ...DEFAULT_OPT_PROGRAMS, ...(data.meta.optionalProgramToggles ?? {}) };
  const productPitTotal = computeProductRelatedPitTotal(
    data.groups,
    yesNoToggles,
    optToggles
  );
  return quoteTotal(data) + pitTotal + productPitTotal;
}

interface AdminQuoteRow {
  id: string;
  data: Quote;
  quoteNumber: string | null;
  companyName: string | null;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
  passStatus: string | null;
  userId: string;
  creatorName: string | null;
  creatorEmail: string | null;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PassFailBadge({ status }: { status: string | null }) {
  if (!status) return <span className="lib-badge lib-badge-none">—</span>;
  if (status === "pass") return <span className="lib-badge lib-badge-pass">PASS</span>;
  return <span className="lib-badge lib-badge-fail">FAIL</span>;
}

/* ── Edit Drawer ─────────────────────────────────────────── */
interface EditDrawerProps {
  row: AdminQuoteRow;
  onClose: () => void;
  onSaved: (updated: AdminQuoteRow) => void;
}

function EditDrawer({ row, onClose, onSaved }: EditDrawerProps) {
  const meta: Partial<QuoteMeta> = row.data?.meta ?? {};
  const [quoteNumber, setQuoteNumber] = useState(meta.quoteNumber ?? "");
  const [oppNumber, setOppNumber] = useState(meta.oppNumber ?? "");
  const [companyName, setCompanyName] = useState(meta.companyName ?? "");
  const [customerName, setCustomerName] = useState(meta.customerName ?? "");
  const [salesRep, setSalesRep] = useState(meta.salesRep ?? "");
  const [validUntil, setValidUntil] = useState(meta.validUntil ?? "");
  const [discount, setDiscount] = useState(String(meta.discount ?? 0));
  const [tax, setTax] = useState(String(meta.tax ?? 0));
  const [notes, setNotes] = useState(meta.notes ?? "");
  const [passStatus, setPassStatus] = useState(row.passStatus ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/quotes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          meta: {
            quoteNumber,
            oppNumber,
            companyName,
            customerName,
            salesRep,
            validUntil,
            discount: parseFloat(discount) || 0,
            tax: parseFloat(tax) || 0,
            notes,
          },
          passStatus: passStatus || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      onSaved({
        ...row,
        companyName: companyName || null,
        customerName: customerName || null,
        quoteNumber: quoteNumber || null,
        passStatus: passStatus || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lib-drawer-backdrop" onClick={onClose}>
      <div className="lib-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="lib-drawer-header">
          <div>
            <h2 className="lib-drawer-title">Edit Quote</h2>
            <p className="lib-drawer-sub">
              Creator: {row.creatorName ?? "—"} &nbsp;·&nbsp; {row.creatorEmail ?? ""}
            </p>
          </div>
          <button type="button" className="lib-drawer-close" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {error && <div className="lib-drawer-error">{error}</div>}

        <form className="lib-drawer-form" onSubmit={handleSave}>
          <div className="lib-form-row2">
            <label className="lib-label">
              Quote #
              <input
                className="lib-input"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
              />
            </label>
            <label className="lib-label">
              Opp #
              <input
                className="lib-input"
                value={oppNumber}
                onChange={(e) => setOppNumber(e.target.value)}
              />
            </label>
          </div>
          <div className="lib-form-row2">
            <label className="lib-label">
              Company Name
              <input
                className="lib-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </label>
            <label className="lib-label">
              Customer Name
              <input
                className="lib-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
          </div>
          <div className="lib-form-row2">
            <label className="lib-label">
              Sales Rep
              <input
                className="lib-input"
                value={salesRep}
                onChange={(e) => setSalesRep(e.target.value)}
              />
            </label>
            <label className="lib-label">
              Valid Until
              <input
                className="lib-input"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </label>
          </div>
          <div className="lib-form-row2">
            <label className="lib-label">
              Discount (%)
              <input
                className="lib-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </label>
            <label className="lib-label">
              Tax (%)
              <input
                className="lib-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
            </label>
          </div>
          <label className="lib-label">
            Pass / Fail Status
            <select
              className="lib-input"
              value={passStatus}
              onChange={(e) => setPassStatus(e.target.value)}
            >
              <option value="">— Not Set —</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </label>
          <label className="lib-label">
            Notes
            <textarea
              className="lib-input lib-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </label>

          <div className="lib-drawer-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function QuoteLibraryPage() {
  const [, setLocation] = useLocation();
  const [quotes, setQuotes] = useState<AdminQuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<AdminQuoteRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/quotes`, {
        credentials: "include",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to load");
      }
      const data = (await res.json()) as { quotes: AdminQuoteRow[] };
      setQuotes([...data.quotes].reverse());
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
    if (!window.confirm("Permanently delete this quote?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/quotes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Delete failed");
      }
      setQuotes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const filtered = quotes.filter((row) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [
      row.quoteNumber,
      row.companyName,
      row.customerName,
      row.creatorName,
      row.creatorEmail,
    ].some((v) => v?.toLowerCase().includes(s));
  });

  return (
    <div className="admin-page-wrap">
      <div className="admin-topbar">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setLocation("/")}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path
              d="M9 2L4 7l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Quotes
        </button>
        <h1 className="admin-page-title">Quote Library</h1>
        <button
          className="btn-ghost sp-refresh-btn"
          onClick={load}
          disabled={loading}
          title="Reload"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M13 8A5 5 0 0 1 3.3 11.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M3 8A5 5 0 0 1 12.7 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M12 2v3h-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 14v-3h3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Refresh
        </button>
      </div>

      <div className="admin-page-content">
        <div className="lib-toolbar">
          <div className="ql-search-wrap" style={{ maxWidth: 340 }}>
            <svg
              className="ql-search-icon"
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
            >
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M9.5 9.5L12 12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <input
              className="ql-search"
              type="text"
              placeholder="Search quotes, customers, creators…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="ql-search-clear"
                onClick={() => setSearch("")}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
          <span className="lib-count">
            {filtered.length} quote{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading && <div className="sp-loading">Loading all quotes…</div>}
        {!loading && error && <div className="sp-error">{error}</div>}

        {!loading && !error && (
          <div className="lib-table-wrap">
            <table className="lib-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Company</th>
                  <th>Customer</th>
                  <th>Creator</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Updated By</th>
                  <th>Status</th>
                  <th className="lib-th-right">Total MRR</th>
                  <th className="lib-th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="lib-td-empty">
                      {search ? `No quotes match "${search}"` : "No quotes have been synced yet"}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id} className="lib-tr">
                    <td className="lib-td-mono">
                      {row.quoteNumber || (
                        <span className="lib-muted">Untitled</span>
                      )}
                    </td>
                    <td>{row.companyName || <span className="lib-muted">—</span>}</td>
                    <td>{row.customerName || <span className="lib-muted">—</span>}</td>
                    <td>
                      <div className="lib-creator">
                        <span className="lib-creator-name">
                          {row.creatorName || "—"}
                        </span>
                        {row.creatorEmail && (
                          <span className="lib-creator-email">
                            {row.creatorEmail}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="lib-td-date">{fmtDate(row.createdAt)}</td>
                    <td className="lib-td-date">{fmtDate(row.updatedAt)}</td>
                    <td>
                      {row.updatedByName || (
                        <span className="lib-muted">—</span>
                      )}
                    </td>
                    <td>
                      <PassFailBadge status={row.passStatus} />
                    </td>
                    <td className="lib-td-right">
                      {row.data
                        ? formatCurrency(computeTotal(row.data))
                        : "—"}
                    </td>
                    <td className="lib-td-right">
                      <div className="lib-actions">
                        <button
                          type="button"
                          className="lib-action-btn"
                          onClick={() => setEditRow(row)}
                          title="Edit quote"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <path
                              d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="lib-action-btn lib-action-delete"
                          onClick={() => handleDelete(row.id)}
                          title="Delete quote"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <path
                              d="M2 3.5h10M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8"
                              stroke="currentColor"
                              strokeWidth="1.3"
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
            setQuotes((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setEditRow(null);
          }}
        />
      )}
    </div>
  );
}
