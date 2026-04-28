import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface PitLineItem {
  id: string;
  name: string;
  duration?: number;
  price?: number;
  pci?: number;
  hwmc?: number;
}

interface PitCategory {
  id: string;
  name: string;
  lineItems: PitLineItem[];
}

interface PitData {
  categories: PitCategory[];
  hourlyRate?: number;
}

function numberOrEmpty(v: unknown): string {
  const n = Number(v);
  return !Number.isNaN(n) && n !== 0 ? String(n) : "";
}

function detectCatType(cat: PitCategory): "duration" | "price" | "both" {
  const hasDuration = cat.lineItems.some((i) => (i.duration ?? 0) > 0);
  const hasPrice = cat.lineItems.some((i) => (i.price ?? 0) > 0);
  if (hasDuration && !hasPrice) return "duration";
  if (hasPrice && !hasDuration) return "price";
  return "both";
}

/* ─── Edit Item Modal ─────────────────────────────────── */
interface EditItemModalProps {
  catId: string;
  catType: "duration" | "price" | "both";
  item: PitLineItem | null;
  mode: "edit" | "add";
  allIds: string[];
  onClose: () => void;
  onSaved: (data: PitData) => void;
}

function EditItemModal({
  catId,
  catType,
  item,
  mode,
  allIds,
  onClose,
  onSaved,
}: EditItemModalProps) {
  const [id, setId] = useState(mode === "edit" ? (item?.id ?? "") : "");
  const [name, setName] = useState(item?.name ?? "");
  const [duration, setDuration] = useState(numberOrEmpty(item?.duration));
  const [price, setPrice] = useState(numberOrEmpty(item?.price));
  const [pci, setPci] = useState(numberOrEmpty(item?.pci));
  const [hwmc, setHwmc] = useState(numberOrEmpty(item?.hwmc));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const idTrimmed = id.trim().toLowerCase();
  const idTaken =
    mode === "add" && idTrimmed.length > 0 && allIds.includes(idTrimmed);

  const showDuration = catType === "duration" || catType === "both";
  const showPrice = catType === "price" || catType === "both";
  const showPciHwmc = catId === "heatmap";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (mode === "add" && !id.trim()) {
      setError("ID is required");
      return;
    }
    if (idTaken) {
      setError("This ID is already in use");
      return;
    }

    const body: Record<string, unknown> = {
      ...(mode === "add" ? { id: id.trim() } : {}),
      name: name.trim(),
      ...(showDuration ? { duration: Number(duration) || 0 } : {}),
      ...(showPrice ? { price: Number(price) || 0 } : {}),
      ...(showPciHwmc ? { pci: Number(pci) || 0, hwmc: Number(hwmc) || 0 } : {}),
    };

    const url =
      mode === "add"
        ? `${API_BASE}/api/admin/pit/categories/${catId}/items`
        : `${API_BASE}/api/admin/pit/categories/${catId}/items/${item!.id}`;
    const method = mode === "add" ? "POST" : "PATCH";

    setLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as PitData & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      onSaved(data);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>{mode === "add" ? "Add Line Item" : "Edit Line Item"}</h3>
          <button
            className="edit-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSave} noValidate>
          {error && <div className="edit-modal-error">{error}</div>}

          <div className="admin-form-row">
            {mode === "add" && (
              <div className="edit-field-group">
                <label>Item ID</label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="nn-005"
                  style={
                    idTaken
                      ? { borderColor: "#ef4444", background: "#fff8f8" }
                      : undefined
                  }
                />
                {idTaken && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#ef4444",
                      marginTop: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <circle
                        cx="8"
                        cy="8"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M8 5v4M8 11v.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    ID not available
                  </span>
                )}
              </div>
            )}
            <div className="edit-field-group" style={{ flex: 2 }}>
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Line item name"
              />
            </div>
          </div>

          <div className="admin-form-row">
            {showDuration && (
              <div className="edit-field-group">
                <label>Duration (hrs)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            {showPrice && (
              <div className="edit-field-group">
                <label>Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          {showPciHwmc && (
            <div className="admin-form-row">
              <div className="edit-field-group">
                <label>PCI ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pci}
                  onChange={(e) => setPci(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="edit-field-group">
                <label>HWMC ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={hwmc}
                  onChange={(e) => setHwmc(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div className="edit-modal-footer">
            <button
              type="button"
              className="edit-modal-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="edit-modal-save"
              disabled={loading}
            >
              {loading
                ? "Saving…"
                : mode === "add"
                  ? "Add item"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Add Category Modal ──────────────────────────────── */
interface AddCategoryModalProps {
  onClose: () => void;
  onSaved: (data: PitData) => void;
}

function AddCategoryModal({ onClose, onSaved }: AddCategoryModalProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"duration" | "price">("duration");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id.trim() || !name.trim()) {
      setError("ID and name are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pit/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: id.trim(), name: name.trim(), type }),
      });
      const data = (await res.json()) as PitData & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      onSaved(data);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>Add Category</h3>
          <button className="edit-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSave} noValidate>
          {error && <div className="edit-modal-error">{error}</div>}
          <div className="edit-field-group">
            <label>
              Category ID{" "}
              <span className="edit-modal-optional">
                (unique slug, e.g. add-on)
              </span>
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="add-on"
            />
          </div>
          <div className="edit-field-group">
            <label>Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add-on Services"
            />
          </div>
          <div className="edit-field-group">
            <label>Item Type</label>
            <select
              className="admin-select"
              value={type}
              onChange={(e) => setType(e.target.value as "duration" | "price")}
            >
              <option value="duration">
                Duration-based (hrs × hourly rate)
              </option>
              <option value="price">Price-based (fixed price)</option>
            </select>
          </div>
          <div className="edit-modal-footer">
            <button
              type="button"
              className="edit-modal-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="edit-modal-save"
              disabled={loading}
            >
              {loading ? "Adding…" : "Add category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────── */
export default function PitConfigPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<PitData | null>(null);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingItem, setEditingItem] = useState<PitLineItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  const [rateInput, setRateInput] = useState("120");
  const [rateSaving, setRateSaving] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);

  const allIds = (data?.categories ?? []).flatMap((c) =>
    c.lineItems.map((i) => i.id.toLowerCase()),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/pit`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Failed to load PIT catalog");
        return;
      }
      const d = (await res.json()) as PitData;
      setData(d);
      if (typeof d.hourlyRate === "number") setRateInput(String(d.hourlyRate));
      if (d.categories.length > 0 && !activeCat)
        setActiveCat(d.categories[0].id);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveRate() {
    const rate = parseFloat(rateInput);
    if (Number.isNaN(rate) || rate <= 0) return;
    setRateSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pit/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hourlyRate: rate }),
      });
      if (res.ok) {
        const d = (await res.json()) as PitData;
        setData(d);
        setRateSaved(true);
        setTimeout(() => setRateSaved(false), 2000);
      }
    } catch {
      /* silent */
    } finally {
      setRateSaving(false);
    }
  }

  async function handleDeleteItem(
    catId: string,
    itemId: string,
    itemName: string,
  ) {
    if (
      !window.confirm(`Delete line item "${itemName}"? This cannot be undone.`)
    )
      return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/pit/categories/${catId}/items/${itemId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        alert(d.error ?? "Delete failed");
        return;
      }
      const d = (await res.json()) as PitData;
      setData(d);
    } catch {
      alert("Network error");
    }
  }

  const currentCat = data?.categories.find((c) => c.id === activeCat);
  const catType = currentCat ? detectCatType(currentCat) : "both";

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <button
          className="btn-ghost admin-back-btn"
          onClick={() => setLocation("/")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
        <h1 className="admin-page-title">PIT Configuration</h1>
        <div className="admin-topbar-right">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--muted)",
                whiteSpace: "nowrap",
              }}
            >
              PIT Hour Rate ($/hr)
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={rateInput}
              onChange={(e) => {
                setRateInput(e.target.value);
                setRateSaved(false);
              }}
              onBlur={handleSaveRate}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              disabled={rateSaving}
              style={{
                width: "100px",
                padding: "7px 13px",
                fontSize: "13px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                background: "var(--surface)",
                color: "var(--text)",
                fontWeight: 600,
              }}
            />
            {rateSaved && (
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--success, #22c55e)",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8l4 4 6-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Saved
              </span>
            )}
          </div>
          <button
            className="admin-btn-add-secondary"
            onClick={() => setAddingCat(true)}
          >
            Add Category
          </button>
          {activeCat && (
            <button
              className="edit-modal-save"
              style={{ padding: "7px 14px", fontSize: "13px" }}
              onClick={() => setAddingItem(true)}
            >
              Add Line Item
            </button>
          )}
        </div>
      </div>

      <div className="admin-content">
        {loading && (
          <div className="admin-loading">
            <div className="spinner" />
          </div>
        )}
        {error && <div className="edit-modal-error">{error}</div>}

        {!loading && data && (
          <>
            <div className="admin-cat-tabs">
              {data.categories.map((c) => (
                <button
                  key={c.id}
                  className={`admin-cat-tab ${activeCat === c.id ? "active" : ""}`}
                  onClick={() => setActiveCat(c.id)}
                >
                  {c.name}
                  <span className="admin-cat-count">{c.lineItems.length}</span>
                </button>
              ))}
            </div>

            {currentCat && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      {(catType === "duration" || catType === "both") && (
                        <th>Duration (hrs)</th>
                      )}
                      {(catType === "price" || catType === "both") && (
                        <th>Price ($)</th>
                      )}
                      {currentCat.id === "heatmap" && <th>PCI ($)</th>}
                      {currentCat.id === "heatmap" && <th>HWMC ($)</th>}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCat.lineItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="admin-table-empty">
                          No line items in this category
                        </td>
                      </tr>
                    )}
                    {currentCat.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <code className="admin-code">{item.id}</code>
                        </td>
                        <td className="admin-td-bold">{item.name}</td>
                        {(catType === "duration" || catType === "both") && (
                          <td>
                            {(item.duration ?? 0) > 0
                              ? `${item.duration} hr${item.duration !== 1 ? "s" : ""}`
                              : "—"}
                          </td>
                        )}
                        {(catType === "price" || catType === "both") && (
                          <td>
                            {(item.price ?? 0) > 0
                              ? `$${(item.price ?? 0).toFixed(2)}`
                              : "—"}
                          </td>
                        )}
                        {currentCat.id === "heatmap" && (
                          <td>
                            {(item.pci ?? 0) > 0
                              ? `$${(item.pci ?? 0).toFixed(2)}`
                              : "—"}
                          </td>
                        )}
                        {currentCat.id === "heatmap" && (
                          <td>
                            {(item.hwmc ?? 0) > 0
                              ? `$${(item.hwmc ?? 0).toFixed(2)}`
                              : "—"}
                          </td>
                        )}
                        <td>
                          <div className="admin-actions">
                            <button
                              className="admin-btn-edit"
                              onClick={() => setEditingItem(item)}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                              >
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
                              className="admin-btn-delete"
                              onClick={() =>
                                handleDeleteItem(
                                  currentCat.id,
                                  item.id,
                                  item.name,
                                )
                              }
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                              >
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
          </>
        )}
      </div>

      {editingItem && currentCat && (
        <EditItemModal
          catId={currentCat.id}
          catType={catType}
          item={editingItem}
          mode="edit"
          allIds={allIds}
          onClose={() => setEditingItem(null)}
          onSaved={(d) => setData(d)}
        />
      )}

      {addingItem && currentCat && (
        <EditItemModal
          catId={currentCat.id}
          catType={catType === "both" ? "duration" : catType}
          item={null}
          mode="add"
          allIds={allIds}
          onClose={() => setAddingItem(false)}
          onSaved={(d) => setData(d)}
        />
      )}

      {addingCat && (
        <AddCategoryModal
          onClose={() => setAddingCat(false)}
          onSaved={(d) => {
            setData(d);
            setActiveCat(d.categories[d.categories.length - 1].id);
          }}
        />
      )}
    </div>
  );
}
