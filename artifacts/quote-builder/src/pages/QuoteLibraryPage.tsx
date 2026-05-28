import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { formatCurrency, quoteTotal } from "../utils/calculations";
import { computeProductRelatedPitTotal } from "../components/ProductRelatedPitSection";
import pitData from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";
import { deleteQuote, setPendingOpenQuote } from "../utils/storage";
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
    ? pitCat.lineItems.reduce((s, i) => s + ("duration" in i ? (i.duration as number) : 0) * PIT_HOURLY_RATE, 0)
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

function StatusBadge({ status }: { status: string | null }) {
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
              Creator: {row.creatorName ?? "—"}
              {row.creatorEmail ? ` · ${row.creatorEmail}` : ""}
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

        {error && <div className="edit-modal-error" style={{ margin: "10px 24px 0" }}>{error}</div>}

        <form className="lib-drawer-form" onSubmit={handleSave}>
          <div className="lib-form-row2">
            <label className="lib-label">
              Quote #
              <input className="lib-input" value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
            </label>
            <label className="lib-label">
              Opp #
              <input className="lib-input" value={oppNumber} onChange={(e) => setOppNumber(e.target.value)} />
            </label>
          </div>
          <div className="lib-form-row2">
            <label className="lib-label">
              Company Name
              <input className="lib-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </label>
            <label className="lib-label">
              Customer Name
              <input className="lib-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </label>
          </div>
          <div className="lib-form-row2">
            <label className="lib-label">
              Sales Rep
              <input className="lib-input" value={salesRep} onChange={(e) => setSalesRep(e.target.value)} />
            </label>
            <label className="lib-label">
              Valid Until
              <input className="lib-input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </label>
          </div>
          <label className="lib-label">
            Pass / Fail Status
            <select className="lib-input" value={passStatus} onChange={(e) => setPassStatus(e.target.value)}>
              <option value="">— Not Set —</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </label>
          <label className="lib-label">
            Notes
            <textarea className="lib-input lib-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
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

/* ── Main Page ───────────────────────────────────────────── */
export default function QuoteLibraryPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [quotes, setQuotes] = useState<AdminQuoteRow[]>([]);
  const [amendCounts, setAmendCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<AdminQuoteRow | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [quotesRes, countsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/quotes`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/amendments/counts`, { credentials: "include" }),
      ]);
      if (!quotesRes.ok) {
        const d = (await quotesRes.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to load");
      }
      const data = (await quotesRes.json()) as { quotes: AdminQuoteRow[] };
      setQuotes([...data.quotes].reverse());
      if (countsRes.ok) {
        const cd = (await countsRes.json()) as { counts: Record<string, number> };
        setAmendCounts(cd.counts ?? {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDuplicate(id: string) {
    setDuplicatingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/quotes/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Duplicate failed");
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to duplicate quote");
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleDelete(id: string, ownerId: string) {
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
      deleteQuote(id, ownerId);
      setQuotes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const filtered = quotes.filter((row) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [row.quoteNumber, row.companyName, row.customerName, row.creatorName, row.creatorEmail]
      .some((v) => v?.toLowerCase().includes(s));
  });

  const groups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      companyName: string;
      rows: AdminQuoteRow[];
    }>();
    for (const row of filtered) {
      const key = (row.companyName || row.customerName || "(No Name)").trim();
      if (!map.has(key)) {
        map.set(key, { key, companyName: key, rows: [] });
      }
      map.get(key)!.rows.push(row);
    }
    return [...map.values()];
  }, [filtered]);

  return (
    <div className="admin-page">
      {/* ── Top bar ── */}
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">Quote Library</h1>

        <div className="admin-topbar-right">
          <span className="admin-badge">{quotes.length} total</span>
          <button
            className="admin-btn-add-secondary"
            onClick={() => void load()}
            disabled={loading}
            title="Reload quotes"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 4 }}>
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2M13.5 2v3.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Content ── */}
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
              placeholder="Search quotes, customers, creators…"
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
                  ? `No quotes match "${search}"`
                  : "No quotes have been synced yet — open any quote in the builder to sync it here."}
              </div>
            )}

            {groups.map((group) => {
              const isOpen = !closedGroups.has(group.key);
              const totalMrr = group.rows.reduce((sum, r) => sum + (r.data ? computeTotal(r.data) : 0), 0);
              const passCount = group.rows.filter(r => r.passStatus === "pass").length;
              const failCount = group.rows.filter(r => r.passStatus === "fail").length;

              return (
                <div key={group.key} className="amend-accordion">
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

                    <span className="amend-accordion-title">{group.companyName}</span>

                    <span className="amend-accordion-meta">
                      <span className="amend-accordion-count">
                        {group.rows.length} quote{group.rows.length !== 1 ? "s" : ""}
                      </span>
                      {passCount > 0 && (
                        <span style={{ fontSize: 11, color: "#15803d", background: "#dcfce7", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
                          {passCount} PASS
                        </span>
                      )}
                      {failCount > 0 && (
                        <span style={{ fontSize: 11, color: "#b91c1c", background: "#fee2e2", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
                          {failCount} FAIL
                        </span>
                      )}
                      <span className="amend-accordion-mrr">
                        {formatCurrency(totalMrr)} MRR
                      </span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="amend-accordion-body">
                      <div className="admin-table-wrap" style={{ borderRadius: 0, border: "none" }}>
                        <table className="admin-table" style={{ borderRadius: 0 }}>
                          <thead>
                            <tr>
                              <th>Quote #</th>
                              <th>Customer</th>
                              {isAdmin && <th>Creator</th>}
                              <th>Created</th>
                              <th>Updated</th>
                              <th>Updated By</th>
                              <th>Status</th>
                              <th style={{ textAlign: "center" }}>Amend</th>
                              <th style={{ textAlign: "right" }}>Total MRR</th>
                              <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => (
                              <tr key={row.id}>
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
                                <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--text-2)" }}>
                                  {fmtDate(row.updatedAt)}
                                </td>
                                <td style={{ fontSize: 12 }}>
                                  {row.updatedByName || <span style={{ color: "var(--text-3)" }}>—</span>}
                                </td>
                                <td>
                                  <StatusBadge status={row.passStatus} />
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  {amendCounts[row.id] ? (
                                    <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>
                                      {amendCounts[row.id]}
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--text-3)" }}>—</span>
                                  )}
                                </td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                  {row.data ? formatCurrency(computeTotal(row.data)) : "—"}
                                </td>
                                <td>
                                  <div className="admin-actions">
                                    <button
                                      type="button"
                                      className="admin-btn-edit"
                                      onClick={() => {
                                        if (row.data) {
                                          setPendingOpenQuote(row.data, row.userId);
                                        }
                                        setLocation("/");
                                      }}
                                      title="Open quote in builder"
                                    >
                                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                        <path d="M7 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M10 1h5v5M15 1L8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      Open
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-btn-edit"
                                      onClick={() => setEditRow(row)}
                                      title="Edit quote metadata (status, numbers)"
                                      style={{ padding: "4px 7px" }}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                        <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-btn-edit"
                                      onClick={() => void handleDuplicate(row.id)}
                                      disabled={duplicatingId === row.id}
                                      title="Duplicate quote"
                                    >
                                      {duplicatingId === row.id ? (
                                        <span className="spinner" style={{ width: 11, height: 11 }} />
                                      ) : (
                                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                          <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                                          <path d="M3 11V2h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                      {duplicatingId === row.id ? "Copying…" : "Duplicate"}
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-btn-delete"
                                      onClick={() => handleDelete(row.id, row.userId)}
                                      title="Delete quote"
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

      {editRow && (
        <EditDrawer
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={(updated) => {
            setQuotes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setEditRow(null);
          }}
        />
      )}
    </div>
  );
}
