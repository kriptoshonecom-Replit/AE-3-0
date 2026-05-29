import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Search, X, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import CustomerModal from "@/components/CustomerModal";
import AddCustomerModal from "@/components/AddCustomerModal";
import type { Quote } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface CustomerQuote {
  id: string;
  quoteNumber: string | null;
  passStatus: string | null;
  createdAt: string;
  updatedAt: string;
  data: Quote | null;
  pdfSavedAt?: string | null;
}

export interface AddressBlock {
  line?: string;
  name: string;
  number: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface CustomerProfile {
  key: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  mcn?: string | null;
  address: AddressBlock | null;
  billingAddress: AddressBlock | null;
  quotes: CustomerQuote[];
  passCount: number;
  failCount: number;
  lastActivity: string;
  creatorName?: string | null;
  creatorEmail?: string | null;
  userId: string;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function HealthBadge({ pass, fail }: { pass: number; fail: number }) {
  const total = pass + fail;
  if (total === 0) return <span className="lib-badge lib-badge-none">—</span>;
  if (pass === total) return <span className="lib-badge lib-badge-pass">PASS</span>;
  if (fail === total) return <span className="lib-badge lib-badge-fail">FAIL</span>;
  return <span className="lib-badge cdm-badge-mix">{pass}P / {fail}F</span>;
}

export default function CDMPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerProfile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CustomerProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/customers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json() as { customers: CustomerProfile[] };
      setCustomers(d.customers);
    } catch {
      setError("Failed to load customer data. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.companyName.toLowerCase().includes(q) ||
      (c.mcn ?? "").toLowerCase().includes(q) ||
      c.customerName.toLowerCase().includes(q) ||
      c.customerEmail.toLowerCase().includes(q) ||
      c.customerPhone.toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${encodeURIComponent(deleteConfirm.key)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Delete failed");
      setCustomers(prev => prev.filter(c => c.key !== deleteConfirm.key));
      if (selected?.key === deleteConfirm.key) setSelected(null);
      setDeleteConfirm(null);
    } catch {
      setDeleteError("Failed to delete customer. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = (updated: CustomerProfile) => {
    setCustomers(prev => prev.map(c => c.key === updated.key ? updated : c));
    setSelected(updated);
  };

  const handleCreated = (created: CustomerProfile) => {
    setCustomers(prev => {
      const exists = prev.find(c => c.key === created.key);
      return exists ? prev.map(c => c.key === created.key ? created : c) : [...prev, created];
    });
  };

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">Customer Data Management</h1>
        <div className="admin-topbar-right">
          <span className="admin-badge">{customers.length} customer{customers.length !== 1 ? "s" : ""}</span>
          {isAdmin && (
            <button
              className="admin-btn-add"
              onClick={() => setShowAddModal(true)}
              title="Add new customer"
            >
              <Plus size={12} style={{ marginRight: 2 }} />
              Add Customer
            </button>
          )}
          <button
            className="admin-btn-add-secondary"
            onClick={() => void load()}
            disabled={loading}
            title="Refresh customers"
          >
            <RefreshCw size={13} style={{ marginRight: 4 }} />
            Refresh
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-toolbar">
          <div className="ql-search-wrap admin-search" style={{ maxWidth: 340 }}>
            <Search size={13} className="ql-search-icon" />
            <input
              type="text"
              className="ql-search"
              placeholder="Search company, name, email, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="ql-search-clear" onClick={() => setSearch("")}>
                <X size={11} />
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
                  <th>Company</th>
                  <th>MCN</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th style={{ textAlign: "center" }}>Quotes</th>
                  <th>Status</th>
                  <th>Last Activity</th>
                  {isAdmin && <th>Account Rep</th>}
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 9} className="admin-table-empty">
                      {search
                        ? `No customers match "${search}"`
                        : "No customer data found — sync quotes to populate this list."}
                    </td>
                  </tr>
                )}
                {filtered.map(c => (
                  <tr
                    key={c.key}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(c)}
                  >
                    <td className="admin-td-bold">
                      {c.companyName || <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {c.mcn || <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td>
                      {c.customerName || <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {c.customerEmail || <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {c.customerPhone || <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 600, color: "var(--accent)" }}>
                      {c.quotes.length}
                    </td>
                    <td>
                      <HealthBadge pass={c.passCount} fail={c.failCount} />
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                      {fmtDate(c.lastActivity)}
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 500, fontSize: 12 }}>{c.creatorName || "—"}</span>
                          {c.creatorEmail && (
                            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{c.creatorEmail}</span>
                          )}
                        </div>
                      </td>
                    )}
                    <td
                      style={{ textAlign: "right" }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="admin-actions">
                        <button
                          className="btn-icon"
                          onClick={() => setSelected(c)}
                          title="View customer"
                        >
                          <Eye size={13} />
                        </button>
                        {isAdmin && (
                          <button
                            className="btn-icon danger"
                            onClick={() => { setDeleteConfirm(c); setDeleteError(""); }}
                            title="Delete customer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleCreated}
        />
      )}

      {selected && (
        <CustomerModal
          customer={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteConfirm && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Delete Customer</h3>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 8px" }}>
                This will permanently delete{" "}
                <strong>{deleteConfirm.quotes.length} quote{deleteConfirm.quotes.length !== 1 ? "s" : ""}</strong>{" "}
                for <strong>{deleteConfirm.companyName || deleteConfirm.customerName || "this customer"}</strong>.
              </p>
              <p style={{ color: "var(--text-3)", fontSize: 13, margin: "0 0 20px" }}>
                This action cannot be undone.
              </p>
              {deleteError && (
                <div className="lib-drawer-error" style={{ marginBottom: 12 }}>{deleteError}</div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  className="admin-btn-add-secondary"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="admin-btn-delete"
                  style={{ padding: "6px 18px" }}
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete Customer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
