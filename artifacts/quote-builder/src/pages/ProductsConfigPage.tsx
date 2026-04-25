import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import MediaPickerModal from "@/components/MediaPickerModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface ProductItem {
  id: string;
  name: string;
  type?: string;
  text?: string;
  image?: string;
  price: number;
  pci?: number;
  produration?: number;
  traduration?: number;
  instaduration?: number;
  stageduration?: number;
}

interface Category {
  id: string;
  name: string;
  items: ProductItem[];
}

interface ProductsData {
  categories: Category[];
}

function numberOrEmpty(v: unknown): string {
  const n = Number(v);
  return Number.isNaN(n) ? "" : String(n);
}

/* ─── Inline Editable Cell ───────────────────────────── */
interface InlineCellProps {
  value: string | number;
  type: "number" | "text";
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  onSave: (raw: string) => void;
}

function InlineCell({ value, type, step = 1, min = 0, prefix = "", suffix = "", className = "", onSave }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);

  function startEdit() {
    setDraft(String(value));
    setEditing(true);
    requestAnimationFrame(() => { inputRef.current?.select(); });
  }

  function commit() {
    setEditing(false);
    if (draft !== String(value)) onSave(draft);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.currentTarget.blur(); }
    if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        step={step}
        min={min}
        autoFocus
        className={`inline-cell-input ${className}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span className={`inline-cell-display ${className}`} onClick={startEdit} title="Click to edit">
      {prefix}{value}{suffix}
    </span>
  );
}

/* ─── Move Product Modal ─────────────────────────────── */
interface MoveProductModalProps {
  item: ProductItem;
  sourceCatId: string;
  categories: Category[];
  onClose: () => void;
  onMoved: (d: ProductsData) => void;
}

function MoveProductModal({ item, sourceCatId, categories, onClose, onMoved }: MoveProductModalProps) {
  const otherCats = categories.filter((c) => c.id !== sourceCatId);
  const [targetCatId, setTargetCatId] = useState(otherCats[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetCatId) { setError("Please select a target category."); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/products/categories/${sourceCatId}/items/${item.id}/move`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ targetCatId }),
        },
      );
      const data = await res.json() as ProductsData & { error?: string };
      if (!res.ok) { setError(data.error ?? "Move failed"); return; }
      onMoved(data);
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="admin-modal-header">
          <h3>Move Product</h3>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
              Moving <strong>{item.name}</strong> to a different category.
            </p>
            <div className="edit-field-group">
              <label>Target Category</label>
              {otherCats.length === 0 ? (
                <p style={{ color: "var(--danger)", fontSize: 13 }}>No other categories available.</p>
              ) : (
                <select
                  value={targetCatId}
                  onChange={(e) => setTargetCatId(e.target.value)}
                >
                  {otherCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            {error && <p className="edit-modal-error">{error}</p>}
          </div>
          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="edit-modal-save" disabled={loading || otherCats.length === 0}>
              {loading ? "Moving…" : "Move Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Edit Product Modal ──────────────────────────────── */
interface EditProductModalProps {
  catId: string;
  item: ProductItem | null;
  onClose: () => void;
  onSaved: (data: ProductsData) => void;
  mode: "edit" | "add";
  allIds: string[];
}

function EditProductModal({ catId, item, onClose, onSaved, mode, allIds }: EditProductModalProps) {
  const [id, setId] = useState(mode === "edit" ? item?.id ?? "" : "");
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState(item?.type ?? "info");
  const [text, setText] = useState(item?.text ?? "");
  const [price, setPrice] = useState(numberOrEmpty(item?.price));
  const [pci, setPci] = useState(numberOrEmpty(item?.pci));
  const [pro, setPro] = useState(numberOrEmpty(item?.produration));
  const [tra, setTra] = useState(numberOrEmpty(item?.traduration));
  const [ins, setIns] = useState(numberOrEmpty(item?.instaduration));
  const [sta, setSta] = useState(numberOrEmpty(item?.stageduration));
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image ?? null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const idTrimmed = id.trim().toLowerCase();
  const idTaken = mode === "add" && idTrimmed.length > 0 && allIds.includes(idTrimmed);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setImageError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".png") || file.type !== "image/png") {
      setImageError("Only PNG files are accepted"); e.target.value = ""; return;
    }

    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) { setImageError("Could not read image"); e.target.value = ""; return; }
    if (bmp.width > 500 || bmp.height > 500) {
      setImageError(`Image must be 500×500 px or smaller (yours: ${bmp.width}×${bmp.height})`);
      e.target.value = ""; return;
    }

    setImageUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/admin/products/upload-image`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json() as { path?: string; error?: string };
      if (!res.ok) { setImageError(data.error ?? "Upload failed"); return; }
      setImageUrl(data.path!);
    } catch { setImageError("Network error during upload"); }
    finally { setImageUploading(false); e.target.value = ""; }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (mode === "add" && !id.trim()) { setError("ID is required"); return; }
    if (idTaken) { setError("This Product ID is already in use — please choose a different one"); return; }

    const body: Record<string, unknown> = {
      ...(mode === "add" ? { id: id.trim() } : {}),
      name: name.trim(), type, text,
      price: Number(price) || 0,
      pci: Number(pci) || 0,
      produration: Number(pro) || 0,
      traduration: Number(tra) || 0,
      instaduration: Number(ins) || 0,
      stageduration: Number(sta) || 0,
      image: imageUrl ?? null,
    };

    const url = mode === "add"
      ? `${API_BASE}/api/admin/products/categories/${catId}/items`
      : `${API_BASE}/api/admin/products/categories/${catId}/items/${item!.id}`;
    const method = mode === "add" ? "POST" : "PATCH";

    setLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json() as ProductsData & { error?: string };
      if (!res.ok) { setError((data as { error?: string }).error ?? "Save failed"); return; }
      onSaved(data);
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal admin-modal-wide">
        <div className="admin-modal-header">
          <h3>{mode === "add" ? "Add Product" : "Edit Product"}</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSave} noValidate>
          {error && <div className="edit-modal-error">{error}</div>}

          <div className="admin-form-row">
            {mode === "add" && (
              <div className="edit-field-group">
                <label>Product ID</label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="tm-005"
                  style={idTaken ? { borderColor: "#ef4444", background: "#fff8f8" } : undefined}
                />
                {idTaken && (
                  <span style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    This ID is not available
                  </span>
                )}
              </div>
            )}
            <div className="edit-field-group" style={{ flex: 2 }}>
              <label>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
            </div>
            <div className="edit-field-group">
              <label>Type</label>
              <select className="admin-select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="product">Product</option>
              </select>
            </div>
          </div>

          <div className="edit-field-group">
            <label>Description / Text</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Short description shown to users" rows={3} />
          </div>

          {showMediaPicker && (
            <MediaPickerModal
              onSelect={(f) => { setImageUrl(f.path); setImageError(""); }}
              onClose={() => setShowMediaPicker(false)}
            />
          )}

          <div className="edit-field-group">
            <label>Product Image <span className="edit-modal-optional">(PNG, max 500×500 px)</span></label>
            <div className="product-img-upload-row">
              {imageUrl ? (
                <div className="product-img-preview">
                  <img src={imageUrl} alt="Product" />
                  <button type="button" className="product-img-remove" onClick={() => setImageUrl(null)} title="Remove image">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="product-img-placeholder">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 15l5-4 4 4 3-2.5 4 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>No image</span>
                </div>
              )}
              <div className="product-img-controls">
                <button
                  type="button"
                  className="product-img-btn product-img-btn-library"
                  onClick={() => setShowMediaPicker(true)}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="5.5" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M1.5 11l3.5-3 3 3 2.5-2.5 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {imageUrl ? "Choose different" : "Choose from library"}
                </button>
                <label className="product-img-btn" aria-disabled={imageUploading}>
                  {imageUploading ? "Uploading…" : "Upload new"}
                  <input
                    type="file"
                    accept=".png,image/png"
                    style={{ display: "none" }}
                    disabled={imageUploading}
                    onChange={handleImageSelect}
                  />
                </label>
                {imageError && (
                  <span className="product-img-error">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {imageError}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="admin-form-row admin-form-row-5">
            <div className="edit-field-group">
              <label>Price ($/mo)</label>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </div>
            <div className="edit-field-group">
              <label>PCI</label>
              <input type="number" min="0" step="0.01" value={pci} onChange={(e) => setPci(e.target.value)} placeholder="0" />
            </div>
            <div className="edit-field-group">
              <label>Pro Duration (h)</label>
              <input type="number" min="0" step="0.5" value={pro} onChange={(e) => setPro(e.target.value)} placeholder="0" />
            </div>
            <div className="edit-field-group">
              <label>Training Duration (h)</label>
              <input type="number" min="0" step="0.5" value={tra} onChange={(e) => setTra(e.target.value)} placeholder="0" />
            </div>
            <div className="edit-field-group">
              <label>Install Duration (h)</label>
              <input type="number" min="0" step="0.5" value={ins} onChange={(e) => setIns(e.target.value)} placeholder="0" />
            </div>
            <div className="edit-field-group">
              <label>Stage Duration (h)</label>
              <input type="number" min="0" step="0.5" value={sta} onChange={(e) => setSta(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="edit-modal-save" disabled={loading}>
              {loading ? "Saving…" : mode === "add" ? "Add product" : "Save changes"}
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
  onSaved: (data: ProductsData) => void;
}

function AddCategoryModal({ onClose, onSaved }: AddCategoryModalProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id.trim() || !name.trim()) { setError("ID and name are required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: id.trim(), name: name.trim() }),
      });
      const data = await res.json() as ProductsData & { error?: string };
      if (!res.ok) { setError((data as { error?: string }).error ?? "Save failed"); return; }
      onSaved(data);
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>Add Category</h3>
          <button className="edit-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSave} noValidate>
          {error && <div className="edit-modal-error">{error}</div>}
          <div className="edit-field-group">
            <label>Category ID <span className="edit-modal-optional">(unique slug, e.g. accessories)</span></label>
            <input type="text" value={id} onChange={(e) => setId(e.target.value)} placeholder="accessories" />
          </div>
          <div className="edit-field-group">
            <label>Display Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Accessories" />
          </div>
          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="edit-modal-save" disabled={loading}>
              {loading ? "Adding…" : "Add category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────── */
export default function ProductsConfigPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<ProductsData | null>(null);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
  const [movingItem, setMovingItem] = useState<ProductItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  const allIds = (data?.categories ?? []).flatMap((c) => c.items.map((i) => i.id.toLowerCase()));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/products`, { credentials: "include" });
      if (!res.ok) { setError("Failed to load products"); return; }
      const d = await res.json() as ProductsData;
      setData(d);
      if (d.categories.length > 0 && !activeCat) setActiveCat(d.categories[0].id);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function patchItem(catId: string, itemId: string, field: string, raw: string) {
    const numFields = ["price", "pci", "produration", "traduration", "instaduration", "stageduration"];
    const val = numFields.includes(field) ? Number(raw) : raw;
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id !== catId ? cat : {
            ...cat,
            items: cat.items.map((item) =>
              item.id !== itemId ? item : { ...item, [field]: val },
            ),
          },
        ),
      };
    });
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/products/categories/${catId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ [field]: val }),
        },
      );
      if (res.ok) {
        const d = await res.json() as ProductsData;
        setData(d);
      }
    } catch { /* silent — optimistic state stays until next reload */ }
  }

  async function handleDeleteItem(catId: string, itemId: string, itemName: string) {
    if (!window.confirm(`Delete product "${itemName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/categories/${catId}/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; alert(d.error ?? "Delete failed"); return; }
      const d = await res.json() as ProductsData;
      setData(d);
    } catch { alert("Network error"); }
  }

  const currentCat = data?.categories.find((c) => c.id === activeCat);

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <button className="btn-ghost admin-back-btn" onClick={() => setLocation("/")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Quotes
        </button>
        <h1 className="admin-page-title">Products Configuration</h1>
        <div className="admin-topbar-right">
          <button className="admin-btn-add-secondary" onClick={() => setAddingCat(true)}>
            Add Category
          </button>
          {activeCat && (
            <button className="edit-modal-save" style={{ padding: "7px 14px", fontSize: "13px" }} onClick={() => setAddingItem(true)}>
              Add Product
            </button>
          )}
        </div>
      </div>

      <div className="admin-content">
        {loading && <div className="admin-loading"><div className="spinner" /></div>}
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
                  <span className="admin-cat-count">{c.items.length}</span>
                </button>
              ))}
            </div>

            {currentCat && (
              <div className="admin-table-wrap">
                <table className="admin-table admin-products-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Media</th>
                      <th>Type</th>
                      <th>Price/mo</th>
                      <th title="Product Cost Indicator">PCI</th>
                      <th>Pro</th>
                      <th>Train</th>
                      <th>Install</th>
                      <th>Stage</th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCat.items.length === 0 && (
                      <tr><td colSpan={12} className="admin-table-empty">No products in this category</td></tr>
                    )}
                    {currentCat.items.map((item) => (
                      <tr key={item.id}>
                        <td><code className="admin-code">{item.id}</code></td>
                        <td className="admin-td-bold">{item.name}</td>
                        <td className="admin-td-media">
                          {item.image && (
                            <img src="/product-btn.png" alt="Has media" className="admin-media-icon" title={item.image} />
                          )}
                        </td>
                        <td><span className={`admin-type-badge type-${item.type}`}>{item.type ?? "—"}</span></td>
                        <td>
                          <InlineCell
                            value={(item.price ?? 0).toFixed(2)}
                            type="number" step={0.01} min={0} prefix="$"
                            onSave={(v) => patchItem(currentCat.id, item.id, "price", v)}
                          />
                        </td>
                        <td>
                          <InlineCell
                            value={(item.pci ?? 0).toFixed(2)}
                            type="number" step={0.01} min={0}
                            onSave={(v) => patchItem(currentCat.id, item.id, "pci", v)}
                          />
                        </td>
                        <td>
                          <InlineCell
                            value={item.produration ?? 0}
                            type="number" step={1} min={0} suffix="h"
                            onSave={(v) => patchItem(currentCat.id, item.id, "produration", v)}
                          />
                        </td>
                        <td>
                          <InlineCell
                            value={item.traduration ?? 0}
                            type="number" step={1} min={0} suffix="h"
                            onSave={(v) => patchItem(currentCat.id, item.id, "traduration", v)}
                          />
                        </td>
                        <td>
                          <InlineCell
                            value={item.instaduration ?? 0}
                            type="number" step={1} min={0} suffix="h"
                            onSave={(v) => patchItem(currentCat.id, item.id, "instaduration", v)}
                          />
                        </td>
                        <td>
                          <InlineCell
                            value={item.stageduration ?? 0}
                            type="number" step={1} min={0} suffix="h"
                            onSave={(v) => patchItem(currentCat.id, item.id, "stageduration", v)}
                          />
                        </td>
                        <td className="admin-td-desc">
                          <InlineCell
                            value={item.text ?? ""}
                            type="text" className="inline-cell-desc"
                            onSave={(v) => patchItem(currentCat.id, item.id, "text", v)}
                          />
                        </td>
                        <td>
                          <div className="admin-actions">
                            <button className="admin-btn-move" onClick={() => setMovingItem(item)}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path d="M8 2v12M2 8l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Move
                            </button>
                            <button className="admin-btn-edit" onClick={() => setEditingItem(item)}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Edit
                            </button>
                            <button className="admin-btn-delete" onClick={() => handleDeleteItem(currentCat.id, item.id, item.name)}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
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
          </>
        )}
      </div>

      {movingItem && currentCat && data && (
        <MoveProductModal
          item={movingItem}
          sourceCatId={currentCat.id}
          categories={data.categories}
          onClose={() => setMovingItem(null)}
          onMoved={(d) => { setData(d); setMovingItem(null); }}
        />
      )}

      {editingItem && currentCat && (
        <EditProductModal
          catId={currentCat.id}
          item={editingItem}
          mode="edit"
          allIds={allIds}
          onClose={() => setEditingItem(null)}
          onSaved={(d) => setData(d)}
        />
      )}

      {addingItem && currentCat && (
        <EditProductModal
          catId={currentCat.id}
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
          onSaved={(d) => { setData(d); setActiveCat(d.categories[d.categories.length - 1].id); }}
        />
      )}
    </div>
  );
}
