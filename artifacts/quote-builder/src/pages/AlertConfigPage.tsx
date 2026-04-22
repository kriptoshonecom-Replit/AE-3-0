import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface AlertConfig {
  id: string;
  subjectProductId: string;
  lookupProductIds: string[];
  displayMessage: string;
  delaySeconds: number;
  isActive: boolean;
  createdAt: string;
}

interface FlatProduct {
  id: string;
  name: string;
  categoryName: string;
}

/* ── Fetch helpers ──────────────────────────────────────────────────────────── */
async function fetchProducts(): Promise<FlatProduct[]> {
  const res = await fetch(`${API_BASE}/api/admin/products`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json() as { categories?: { id: string; name: string; items: { id: string; name: string }[] }[] };
  const flat: FlatProduct[] = [];
  for (const cat of data.categories ?? []) {
    for (const item of cat.items ?? []) {
      flat.push({ id: item.id, name: item.name, categoryName: cat.name });
    }
  }
  return flat;
}

/* ── Add / Edit Modal ───────────────────────────────────────────────────────── */
interface ModalProps {
  config: AlertConfig | null;
  products: FlatProduct[];
  onClose: () => void;
  onSaved: (cfg: AlertConfig) => void;
}

function AlertModal({ config, products, onClose, onSaved }: ModalProps) {
  const isEdit = config !== null;
  const [subjectId, setSubjectId] = useState(config?.subjectProductId ?? "");
  const [lookupIds, setLookupIds] = useState<string[]>(config?.lookupProductIds ?? []);
  const [message, setMessage] = useState(config?.displayMessage ?? "");
  const [delay, setDelay] = useState(String(config?.delaySeconds ?? 5));
  const [active, setActive] = useState(config?.isActive ?? true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleLookup(id: string) {
    setLookupIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!subjectId) { setError("Please select a subject product."); return; }
    if (lookupIds.length === 0) { setError("Select at least one quantity lookup product."); return; }
    const delayNum = parseInt(delay, 10);
    if (isNaN(delayNum) || delayNum < 0) { setError("Delay must be 0 or more seconds."); return; }

    setLoading(true);
    try {
      const url = isEdit
        ? `${API_BASE}/api/admin/alert-configs/${config!.id}`
        : `${API_BASE}/api/admin/alert-configs`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subjectProductId: subjectId,
          lookupProductIds: lookupIds,
          displayMessage: message.trim(),
          delaySeconds: delayNum,
          isActive: active,
        }),
      });
      const data = await res.json() as AlertConfig & { error?: string };
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onSaved(data);
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  const grouped = products.reduce<Record<string, FlatProduct[]>>((acc, p) => {
    (acc[p.categoryName] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="admin-modal" style={{ maxWidth: 520 }}>
        <div className="admin-modal-header">
          <h3>{isEdit ? "Edit Alert" : "Add Alert"}</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form className="admin-modal-body" onSubmit={handleSubmit}>
          {error && <div className="edit-modal-error">{error}</div>}

          {/* Subject Product */}
          <div className="edit-field-group">
            <label>Subject Product <span style={{ color: "#e55" }}>*</span></label>
            <p className="edit-field-hint">The product whose quantity will be auto-adjusted.</p>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
            >
              <option value="">— Select product —</option>
              {Object.entries(grouped).map(([cat, items]) => (
                <optgroup key={cat} label={cat}>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Quantity Lookup Products */}
          <div className="edit-field-group">
            <label>Quantity Lookup Products <span style={{ color: "#e55" }}>*</span></label>
            <p className="edit-field-hint">Products to count. When their total qty doesn't match the subject, the alert fires.</p>
            <div className="alert-lookup-list">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="alert-lookup-group">
                  <div className="alert-lookup-cat">{cat}</div>
                  {items.map((p) => (
                    <label key={p.id} className="alert-lookup-item">
                      <input
                        type="checkbox"
                        checked={lookupIds.includes(p.id)}
                        onChange={() => toggleLookup(p.id)}
                      />
                      <span>{p.name}</span>
                      <code className="admin-code" style={{ marginLeft: "auto", fontSize: 11 }}>{p.id}</code>
                    </label>
                  ))}
                </div>
              ))}
              {products.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "6px 0" }}>No products found</div>
              )}
            </div>
          </div>

          {/* Display Message */}
          <div className="edit-field-group">
            <label>Display Message</label>
            <p className="edit-field-hint">Optional custom message shown in the alert popup.</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="e.g., Your license count must match the total number of terminals and tablets."
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {/* Delay + Active row */}
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div className="edit-field-group" style={{ flex: 1 }}>
              <label>Delay (seconds)</label>
              <p className="edit-field-hint">Wait time after product is selected before showing the alert.</p>
              <input
                type="number"
                min={0}
                max={60}
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
              />
            </div>
            <div className="edit-field-group" style={{ flex: 1 }}>
              <label>Status</label>
              <p className="edit-field-hint">Inactive alerts won't fire in the quote builder.</p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingTop: 4 }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: "pointer" }}
                />
                <span style={{ fontSize: 13 }}>Active</span>
              </label>
            </div>
          </div>

          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="edit-modal-save" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ───────────────────────────────────────────────────── */
function DeleteModal({ config, onClose, onDeleted }: { config: AlertConfig; onClose: () => void; onDeleted: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/alert-configs/${config.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Delete failed"); return; }
      onDeleted(config.id);
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal" style={{ maxWidth: 400 }}>
        <div className="admin-modal-header">
          <h3>Delete Alert</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="admin-modal-body">
          {error && <div className="edit-modal-error">{error}</div>}
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Are you sure you want to delete this alert? This action cannot be undone.
          </p>
          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="edit-modal-save"
              style={{ background: "var(--danger, #e55)", color: "#fff" }}
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */
export default function AlertConfigPage() {
  const [, setLocation] = useLocation();
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [products, setProducts] = useState<FlatProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<AlertConfig | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertConfig | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/admin/alert-configs`, { credentials: "include" })
        .then((r) => r.json() as Promise<AlertConfig[]>),
      fetchProducts(),
    ]).then(([cfgs, prods]) => {
      setConfigs(Array.isArray(cfgs) ? cfgs : []);
      setProducts(prods);
    }).catch(() => setConfigs([])).finally(() => setLoading(false));
  }, []);

  async function toggleActive(cfg: AlertConfig) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/alert-configs/${cfg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !cfg.isActive }),
      });
      const updated = await res.json() as AlertConfig;
      if (res.ok) setConfigs((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    } catch { /* silent */ }
  }

  function productName(id: string) {
    return products.find((p) => p.id === id)?.name ?? id;
  }

  function lookupSummary(ids: string[]) {
    if (ids.length === 0) return "—";
    return ids.map((id) => productName(id)).join(", ");
  }

  return (
    <div className="admin-page">
      {editTarget !== null && (
        <AlertModal
          config={editTarget === "new" ? null : editTarget}
          products={products}
          onClose={() => setEditTarget(null)}
          onSaved={(cfg) => {
            if (editTarget === "new") {
              setConfigs((prev) => [...prev, cfg]);
            } else {
              setConfigs((prev) => prev.map((c) => c.id === cfg.id ? cfg : c));
            }
          }}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          config={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) => setConfigs((prev) => prev.filter((c) => c.id !== id))}
        />
      )}

      <div className="admin-topbar">
        <button className="btn-ghost admin-back-btn" onClick={() => setLocation("/")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Quotes
        </button>
        <h1 className="admin-page-title">Alert Configuration</h1>
        <div className="admin-topbar-right">
          <button className="btn-primary" onClick={() => setEditTarget("new")}>
            Add Alert
          </button>
        </div>
      </div>

      <div className="admin-table-wrap">
        {loading ? (
          <div className="admin-table-empty" style={{ padding: 32 }}>
            <span className="btn-spinner" style={{ width: 20, height: 20 }} />
          </div>
        ) : configs.length === 0 ? (
          <div className="admin-table-empty" style={{ padding: 32 }}>
            No alerts configured yet. Click <strong>Add Alert</strong> to create one.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Subject Product</th>
                <th>Quantity Lookup</th>
                <th>Display Message</th>
                <th>Delay</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg) => (
                <tr key={cfg.id}>
                  <td>
                    <div className="admin-td-bold">{productName(cfg.subjectProductId)}</div>
                    <code className="admin-code">{cfg.subjectProductId}</code>
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {lookupSummary(cfg.lookupProductIds)}
                    </div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {cfg.displayMessage || <em style={{ opacity: 0.5 }}>Default message</em>}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{cfg.delaySeconds}s</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleActive(cfg)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 11, fontWeight: 600, padding: "3px 10px",
                        borderRadius: 20, border: "none", cursor: "pointer",
                        background: cfg.isActive ? "var(--success-bg, #dcfce7)" : "var(--muted-bg, #f1f5f9)",
                        color: cfg.isActive ? "var(--success, #16a34a)" : "var(--text-muted)",
                      }}
                    >
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: cfg.isActive ? "var(--success, #16a34a)" : "var(--text-muted)",
                        display: "inline-block", flexShrink: 0,
                      }} />
                      {cfg.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="admin-btn-edit"
                        onClick={() => setEditTarget(cfg)}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Edit
                      </button>
                      <button
                        className="admin-btn-delete"
                        onClick={() => setDeleteTarget(cfg)}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M3 4h10M5 4V2.5h6V4M6 7v4M10 7v4M4 4l.5 9.5h7L12 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .edit-field-hint {
          font-size: 11px;
          color: var(--text-muted);
          margin: 2px 0 6px;
        }
        .alert-lookup-list {
          border: 1px solid var(--border);
          border-radius: 6px;
          max-height: 200px;
          overflow-y: auto;
          padding: 4px 0;
        }
        .alert-lookup-group { padding: 0 8px 4px; }
        .alert-lookup-cat {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          padding: 6px 0 3px;
        }
        .alert-lookup-item {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 4px 4px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12.5px;
          color: var(--text);
        }
        .alert-lookup-item:hover { background: var(--hover-bg, rgba(0,0,0,.04)); }
        .alert-lookup-item input { flex-shrink: 0; cursor: pointer; }
      `}</style>
    </div>
  );
}
