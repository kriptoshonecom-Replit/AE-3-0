import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface MediaFile {
  id: string;
  originalName: string;
  slug: string;
  path: string;
  uploadedAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* ── Rename Modal ──────────────────────────────────────── */
function RenameModal({ file, onClose, onSaved }: { file: MediaFile; onClose: () => void; onSaved: (f: MediaFile) => void }) {
  const [name, setName] = useState(file.originalName);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/media/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ originalName: name.trim() }),
      });
      const data = await res.json() as MediaFile & { error?: string };
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onSaved(data);
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>Rename File</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSave}>
          {error && <div className="edit-modal-error">{error}</div>}
          <div className="edit-field-group">
            <label>Display name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="edit-modal-save" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ─────────────────────────────── */
function DeleteConfirmModal({ file, onClose, onDeleted }: { file: MediaFile; onClose: () => void; onDeleted: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/media/${file.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Delete failed");
        return;
      }
      onDeleted(file.id);
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>Delete Image</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="admin-modal-body">
          {error && <div className="edit-modal-error">{error}</div>}
          <p style={{ margin: "0 0 16px", color: "var(--text-2)", fontSize: "14px" }}>
            Delete <strong style={{ color: "var(--text)" }}>{file.originalName}</strong>? This cannot be undone and may break any products that use this image.
          </p>
          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="media-delete-btn-confirm" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */
export default function MediaFilesPage() {
  const [, setLocation] = useLocation();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [search, setSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/media`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: MediaFile[]) => setFiles(data))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...files]
    .filter((f) => f.originalName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortBy === "date"
        ? new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        : a.originalName.localeCompare(b.originalName)
    );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".png") || file.type !== "image/png") {
      setUploadError("Only PNG files are accepted"); e.target.value = ""; return;
    }

    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) { setUploadError("Could not read image"); e.target.value = ""; return; }
    if (bmp.width > 500 || bmp.height > 500) {
      setUploadError(`Image must be 500×500 px or smaller (yours: ${bmp.width}×${bmp.height})`);
      e.target.value = ""; return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/admin/media/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json() as MediaFile & { error?: string };
      if (!res.ok) { setUploadError(data.error ?? "Upload failed"); return; }
      setFiles((prev) => [data, ...prev]);
    } catch { setUploadError("Network error during upload"); }
    finally { setUploading(false); e.target.value = ""; }
  }

  function copyPath(file: MediaFile) {
    const url = `${window.location.origin}${file.path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(file.id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="admin-page">
      {renameTarget && (
        <RenameModal
          file={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSaved={(updated) => setFiles((prev) => prev.map((f) => f.id === updated.id ? updated : f))}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          file={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
        />
      )}

      <div className="admin-topbar">
        <button className="btn-ghost admin-back-btn" onClick={() => setLocation("/")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Quotes
        </button>
        <h1 className="admin-page-title">Media Files</h1>
        <div className="admin-topbar-right">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <span className="btn-spinner" />
                Uploading…
              </>
            ) : (
              "Upload Image"
            )}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="media-upload-error">{uploadError}</div>
      )}

      <div className="media-toolbar">
        <div className="media-search-wrap">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="media-search-icon">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            className="media-search"
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="media-sort-group">
          <span className="media-sort-label">Sort:</span>
          <button
            className={`media-sort-btn${sortBy === "date" ? " active" : ""}`}
            onClick={() => setSortBy("date")}
          >Newest</button>
          <button
            className={`media-sort-btn${sortBy === "name" ? " active" : ""}`}
            onClick={() => setSortBy("name")}
          >Name</button>
        </div>
      </div>

      <div className="media-content">
        {loading ? (
          <div className="media-empty"><span className="btn-spinner" style={{ width: 20, height: 20 }} /></div>
        ) : sorted.length === 0 ? (
          <div className="media-empty">
            {search ? "No images match your search." : "No images uploaded yet. Click \"Upload Image\" to add your first file."}
          </div>
        ) : (
          <div className="media-grid">
            {sorted.map((file) => (
              <div key={file.id} className="media-card">
                <div className="media-card-img-wrap">
                  <img src={file.path} alt={file.originalName} className="media-card-img" />
                </div>
                <div className="media-card-info">
                  <div className="media-card-name" title={file.originalName}>{file.originalName}</div>
                  <div className="media-card-date">{formatDate(file.uploadedAt)}</div>
                </div>
                <div className="media-card-actions">
                  <button
                    className="media-action-btn"
                    title="Copy URL"
                    onClick={() => copyPath(file)}
                  >
                    {copied === file.id ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l4 4 6-7" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <rect x="5" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M3 5H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="media-action-btn"
                    title="Rename"
                    onClick={() => setRenameTarget(file)}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    className="media-action-btn media-action-btn-danger"
                    title="Delete"
                    onClick={() => setDeleteTarget(file)}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
