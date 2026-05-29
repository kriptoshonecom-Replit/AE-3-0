import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface MediaFile {
  id: string;
  originalName: string;
  slug: string;
  path: string;
  uploadedAt: string;
}

interface Props {
  onSelect: (file: MediaFile) => void;
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function MediaPickerModal({ onSelect, onClose }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");

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

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal admin-modal-wide media-picker-modal">
        <div className="admin-modal-header">
          <h3>Choose from Media Library</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="media-picker-toolbar">
          <div className="media-search-wrap">
            <Search size={13} className="media-search-icon" />
            <input
              className="media-search"
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="media-sort-group">
            <button className={`media-sort-btn${sortBy === "date" ? " active" : ""}`} onClick={() => setSortBy("date")}>Newest</button>
            <button className={`media-sort-btn${sortBy === "name" ? " active" : ""}`} onClick={() => setSortBy("name")}>Name</button>
          </div>
        </div>

        <div className="media-picker-body">
          {loading ? (
            <div className="media-empty"><span className="btn-spinner" style={{ width: 20, height: 20 }} /></div>
          ) : sorted.length === 0 ? (
            <div className="media-empty">
              {search ? "No images match your search." : "No images in the library yet. Upload images via the Media Files page first."}
            </div>
          ) : (
            <div className="media-picker-grid">
              {sorted.map((file) => (
                <button
                  key={file.id}
                  className="media-picker-card"
                  onClick={() => { onSelect(file); onClose(); }}
                  title={file.originalName}
                >
                  <div className="media-picker-img-wrap">
                    <img src={file.path} alt={file.originalName} className="media-picker-img" />
                  </div>
                  <div className="media-picker-name">{file.originalName}</div>
                  <div className="media-picker-date">{formatDate(file.uploadedAt)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="media-picker-footer">
          <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
