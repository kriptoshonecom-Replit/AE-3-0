import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, AlertCircle, Image, Pencil, Copy, Trash2, ArrowUp } from "lucide-react";
import { useLocation } from "wouter";
import MediaPickerModal from "@/components/MediaPickerModal";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { RichTextEditor } from "@/components/RichTextEditor";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface ProductItem {
  id: string;
  name: string;
  type?: string;
  text?: string;
  image?: string;
  price: number;
  pci?: number;
  hwmc?: number;
  produration?: number;
  traduration?: number;
  instaduration?: number;
  stageduration?: number;
  /** Restocking Fee — dollar amount charged on return */
  rf?: number;
  /** Quantity Limit Toggle — when true, quantity is locked to 1 in quotes */
  qlt?: boolean;
  /** Exclusive Group — products sharing the same label are mutually exclusive */
  exclusiveGroup?: string;
}

interface Category {
  id: string;
  name: string;
  items: ProductItem[];
}

interface ProductsData {
  categories: Category[];
  tieredAdditionalPrice?: number;
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
  placeholder?: string;
  onSave: (raw: string) => void;
}

function InlineCell({ value, type, step = 1, min = 0, prefix = "", suffix = "", className = "", placeholder, onSave }: InlineCellProps) {
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
        placeholder={placeholder}
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
          <div className="edit-modal-footer" style={{ padding: "18px 20px 20px" }}>
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
  mode: "edit" | "add" | "duplicate";
  allIds: string[];
}

function EditProductModal({ catId, item, onClose, onSaved, mode, allIds }: EditProductModalProps) {
  const [id, setId] = useState(
    mode === "edit" ? item?.id ?? "" :
    mode === "duplicate" ? `${item?.id ?? ""}-copy` : ""
  );
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState(item?.type ?? "info");
  const [text, setText] = useState(item?.text ?? "");
  const [price, setPrice] = useState(numberOrEmpty(item?.price));
  const [pci, setPci] = useState(numberOrEmpty(item?.pci));
  const [hwmc, setHwmc] = useState(numberOrEmpty(item?.hwmc));
  const [pro, setPro] = useState(numberOrEmpty(item?.produration));
  const [tra, setTra] = useState(numberOrEmpty(item?.traduration));
  const [ins, setIns] = useState(numberOrEmpty(item?.instaduration));
  const [sta, setSta] = useState(numberOrEmpty(item?.stageduration));
  const [rf, setRf] = useState(numberOrEmpty(item?.rf));
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image ?? null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const idTrimmed = id.trim().toLowerCase();
  // In edit mode, the current item's own ID is allowed — only other IDs are duplicates
  const idTaken = idTrimmed.length > 0 && allIds.includes(idTrimmed) &&
    (mode !== "edit" || idTrimmed !== (item?.id ?? "").toLowerCase());

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
    if (!id.trim()) { setError("ID is required"); return; }
    if (idTaken) { setError("This Product ID is already in use — please choose a different one"); return; }

    const body: Record<string, unknown> = {
      ...(mode !== "edit" ? { id: id.trim() } : {}),
      // In edit mode, send newId only when the admin changed the ID
      ...(mode === "edit" && id.trim() !== (item?.id ?? "") ? { newId: id.trim() } : {}),
      name: name.trim(), type, text,
      price: Number(price) || 0,
      pci: Number(pci) || 0,
      hwmc: Number(hwmc) || 0,
      produration: Number(pro) || 0,
      traduration: Number(tra) || 0,
      instaduration: Number(ins) || 0,
      stageduration: Number(sta) || 0,
      rf: Number(rf) || 0,
      image: imageUrl ?? null,
    };

    const url = mode === "edit"
      ? `${API_BASE}/api/admin/products/categories/${catId}/items/${item!.id}`
      : `${API_BASE}/api/admin/products/categories/${catId}/items`;
    const method = mode === "edit" ? "PATCH" : "POST";

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
          <h3>{mode === "add" ? "Add Product" : mode === "duplicate" ? "Duplicate Product" : "Edit Product"}</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSave} noValidate>
          {error && <div className="edit-modal-error">{error}</div>}

          <div className="admin-form-row">
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
                  <AlertCircle size={12} />
                  This ID is already in use
                </span>
              )}
            </div>
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
            <RichTextEditor
              value={text}
              onChange={setText}
              placeholder="Short description shown to users"
              minHeight={80}
            />
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
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="product-img-placeholder">
                  <Image size={28} />
                  <span>No image</span>
                </div>
              )}
              <div className="product-img-controls">
                <button
                  type="button"
                  className="product-img-btn product-img-btn-library"
                  onClick={() => setShowMediaPicker(true)}
                >
                  <Image size={12} />
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
                    <AlertCircle size={11} />
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
              <label>HWMC</label>
              <input type="number" min="0" step="0.01" value={hwmc} onChange={(e) => setHwmc(e.target.value)} placeholder="0" />
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
            <div className="edit-field-group">
              <label>RF ($)</label>
              <input type="number" min="0" step="0.01" value={rf} onChange={(e) => setRf(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="edit-modal-save" disabled={loading}>
              {loading ? "Saving…" : mode === "add" ? "Add product" : mode === "duplicate" ? "Create copy" : "Save changes"}
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
            <X size={15} />
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
  const [tieredInput, setTieredInput] = useState("30");
  const [tieredSaving, setTieredSaving] = useState(false);
  const [tieredSaved, setTieredSaved] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState<ProductItem | null>(null);

  const allIds = (data?.categories ?? []).flatMap((c) => c.items.map((i) => i.id.toLowerCase()));

  // ── Drag-to-reorder state ───────────────────────────────────────────────────
  const dragSrcIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Reset drag state whenever the active category changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { dragSrcIdx.current = null; setDragOverIdx(null); }, [activeCat]);

  async function reorderItems(catId: string, items: ProductItem[]) {
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id !== catId ? cat : { ...cat, items },
        ),
      };
    });
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/products/categories/${catId}/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ itemIds: items.map((i) => i.id) }),
        },
      );
      if (res.ok) {
        const d = await res.json() as ProductsData;
        setData(d);
      }
    } catch { /* silent — optimistic state stays */ }
  }

  function moveItemInDirection(catId: string, idx: number, dir: -1 | 1) {
    const cat = data?.categories.find((c) => c.id === catId);
    if (!cat) return;
    const items = [...cat.items];
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    [items[idx], items[target]] = [items[target], items[idx]];
    void reorderItems(catId, items);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/products`, { credentials: "include" });
      if (!res.ok) { setError("Failed to load products"); return; }
      const d = await res.json() as ProductsData;
      setData(d);
      setTieredInput(String(d.tieredAdditionalPrice ?? 30));
      if (d.categories.length > 0 && !activeCat) setActiveCat(d.categories[0].id);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function patchItem(catId: string, itemId: string, field: string, raw: string | boolean | null) {
    const numFields = ["price", "pci", "hwmc", "produration", "traduration", "instaduration", "stageduration", "rf"];
    const val = raw === null ? null : typeof raw === "boolean" ? raw : numFields.includes(field) ? Number(raw) : raw;
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

  async function handleSaveTiered() {
    const val = parseFloat(tieredInput);
    if (isNaN(val) || val < 0) return;
    setTieredSaving(true);
    try {
      await fetch(`${API_BASE}/api/admin/products/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tieredAdditionalPrice: val }),
      });
      setTieredSaved(true);
      setTimeout(() => setTieredSaved(false), 2000);
    } finally {
      setTieredSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">Products Configuration</h1>
        <div className="admin-topbar-right">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>
              Tiered Add'l Unit Price ($/unit)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tieredInput}
              onChange={(e) => { setTieredInput(e.target.value); setTieredSaved(false); }}
              onBlur={handleSaveTiered}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              disabled={tieredSaving}
              style={{ width: "80px", padding: "7px 10px", fontSize: "13px", border: "1.5px solid var(--border)", borderRadius: "8px", background: "var(--surface)" }}
            />
            {tieredSaved && <span style={{ fontSize: "12px", color: "var(--success, #16a34a)", fontWeight: 600 }}>Saved ✓</span>}
          </div>
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
                      <th style={{ width: 24 }}></th>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Media</th>
                      <th>Type</th>
                      <th>Price/mo</th>
                      <th title="Product Cost Indicator">PCI</th>
                      <th title="Hardware Maintenance Cost">HWMC</th>
                      <th>Pro</th>
                      <th>Train</th>
                      <th>Install</th>
                      <th>Stage</th>
                      <th title="Restocking Fee per unit">RF</th>
                      <th title="Quantity Limit Toggle — when On, quantity is locked to 1">QLT</th>
                      <th title="Exclusive Group — products sharing the same label are mutually exclusive in the quote builder">Excl. Group</th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCat.items.length === 0 && (
                      <tr><td colSpan={17} className="admin-table-empty">No products in this category</td></tr>
                    )}
                    {currentCat.items.map((item, idx) => (
                      <tr
                        key={item.id}
                        draggable
                        onDragStart={() => { dragSrcIdx.current = idx; }}
                        onDragOver={(e) => { e.preventDefault(); if (dragOverIdx !== idx) setDragOverIdx(idx); }}
                        onDragEnd={() => { dragSrcIdx.current = null; setDragOverIdx(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const src = dragSrcIdx.current;
                          if (src === null || src === idx) { setDragOverIdx(null); return; }
                          const items = [...currentCat.items];
                          const [moved] = items.splice(src, 1);
                          items.splice(idx, 0, moved);
                          void reorderItems(currentCat.id, items);
                          dragSrcIdx.current = null;
                          setDragOverIdx(null);
                        }}
                        className={
                          dragSrcIdx.current === idx ? "admin-row-dragging" :
                          dragOverIdx === idx ? "admin-row-drag-over" : ""
                        }
                      >
                        <td className="drag-handle-cell">
                          <span className="drag-handle" title="Drag to reorder">⠿</span>
                        </td>
                        <td><code className="admin-code">{item.id}</code></td>
                        <td className="admin-td-bold">{item.name}</td>
                        <td className="admin-td-media">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="admin-media-icon" title={item.image} />
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
                            value={(item.hwmc ?? 0).toFixed(2)}
                            type="number" step={0.01} min={0}
                            onSave={(v) => patchItem(currentCat.id, item.id, "hwmc", v)}
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
                        <td>
                          <InlineCell
                            value={(item.rf ?? 0).toFixed(2)}
                            type="number" step={0.01} min={0} prefix="$"
                            onSave={(v) => patchItem(currentCat.id, item.id, "rf", v)}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.qlt ?? false}
                            title={item.qlt ? "QLT On — quantity locked to 1" : "QLT Off"}
                            className={`pit-toggle-switch ${(item.qlt ?? false) ? "pit-toggle-on" : "pit-toggle-off"}`}
                            style={{ transform: "scale(0.85)" }}
                            onClick={() => patchItem(currentCat.id, item.id, "qlt", !item.qlt)}
                          >
                            <span className="pit-toggle-thumb" />
                          </button>
                        </td>
                        <td>
                          <InlineCell
                            value={item.exclusiveGroup ?? ""}
                            type="text"
                            placeholder="none"
                            onSave={(v) => patchItem(currentCat.id, item.id, "exclusiveGroup", (v as string).trim() || null)}
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
                            <button
                              className="admin-btn-reorder"
                              title="Move up"
                              disabled={idx === 0}
                              onClick={() => moveItemInDirection(currentCat.id, idx, -1)}
                            >▲</button>
                            <button
                              className="admin-btn-reorder"
                              title="Move down"
                              disabled={idx === currentCat.items.length - 1}
                              onClick={() => moveItemInDirection(currentCat.id, idx, 1)}
                            >▼</button>
                            <button className="admin-btn-move" onClick={() => setMovingItem(item)}>
                              <ArrowUp size={12} />
                              Move
                            </button>
                            <button className="admin-btn-edit" onClick={() => setEditingItem(item)}>
                              <Pencil size={12} />
                              Edit
                            </button>
                            <button
                              className="admin-btn-edit"
                              title="Duplicate product"
                              onClick={() => setDuplicateFrom(item)}
                            >
                              <Copy size={12} />
                              Duplicate
                            </button>
                            <button className="admin-btn-delete" onClick={() => handleDeleteItem(currentCat.id, item.id, item.name)}>
                              <Trash2 size={12} />
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

      {duplicateFrom && currentCat && (
        <EditProductModal
          catId={currentCat.id}
          item={duplicateFrom}
          mode="duplicate"
          allIds={allIds}
          onClose={() => setDuplicateFrom(null)}
          onSaved={(d) => { setData(d); setDuplicateFrom(null); }}
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
