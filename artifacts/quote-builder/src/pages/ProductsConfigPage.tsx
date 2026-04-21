import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

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

/* ─── Edit Product Modal ──────────────────────────────── */
interface EditProductModalProps {
  catId: string;
  item: ProductItem | null;
  onClose: () => void;
  onSaved: (data: ProductsData) => void;
  mode: "edit" | "add";
}

function EditProductModal({ catId, item, onClose, onSaved, mode }: EditProductModalProps) {
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (mode === "add" && !id.trim()) { setError("ID is required"); return; }

    const body = {
      ...(mode === "add" ? { id: id.trim() } : {}),
      name: name.trim(), type, text,
      price: Number(price) || 0,
      pci: Number(pci) || 0,
      produration: Number(pro) || 0,
      traduration: Number(tra) || 0,
      instaduration: Number(ins) || 0,
      stageduration: Number(sta) || 0,
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
                <label>Product ID <span className="edit-modal-optional">(unique, e.g. tm-005)</span></label>
                <input type="text" value={id} onChange={(e) => setId(e.target.value)} placeholder="tm-005" />
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
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Short description shown to users" />
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
  const [addingItem, setAddingItem] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

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
                      <tr><td colSpan={11} className="admin-table-empty">No products in this category</td></tr>
                    )}
                    {currentCat.items.map((item) => (
                      <tr key={item.id}>
                        <td><code className="admin-code">{item.id}</code></td>
                        <td className="admin-td-bold">{item.name}</td>
                        <td><span className={`admin-type-badge type-${item.type}`}>{item.type ?? "—"}</span></td>
                        <td>${(item.price ?? 0).toFixed(2)}</td>
                        <td>{(item.pci ?? 0).toFixed(2)}</td>
                        <td>{item.produration ?? 0}h</td>
                        <td>{item.traduration ?? 0}h</td>
                        <td>{item.instaduration ?? 0}h</td>
                        <td>{item.stageduration ?? 0}h</td>
                        <td className="admin-td-desc">{item.text ?? "—"}</td>
                        <td>
                          <div className="admin-actions">
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

      {editingItem && currentCat && (
        <EditProductModal
          catId={currentCat.id}
          item={editingItem}
          mode="edit"
          onClose={() => setEditingItem(null)}
          onSaved={(d) => setData(d)}
        />
      )}

      {addingItem && currentCat && (
        <EditProductModal
          catId={currentCat.id}
          item={null}
          mode="add"
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
