import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface ReleaseNotification {
  id: string;
  subject: string;
  message: string;
  recipientEmails: string[];
  sentAt: string | null;
  sentBy: string | null;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function validateVersion(v: string) {
  return /^\d+\.\d+(\.\d+)?$/.test(v.trim());
}

export default function AppReleasePage() {
  const [, setLocation] = useLocation();

  /* ── App Version ── */
  const [currentVersion, setCurrentVersion] = useState("6.0");
  const [versionInput, setVersionInput] = useState("6.0");
  const [versionSaving, setVersionSaving] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [versionSuccess, setVersionSuccess] = useState("");

  /* ── Compose ── */
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectAll, setSelectAll] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [composeSuccess, setComposeSuccess] = useState("");

  /* ── Data ── */
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notifications, setNotifications] = useState<ReleaseNotification[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Delete confirm ── */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, uRes, nRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/app-version`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/users`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/release-notifications`, { credentials: "include" }),
      ]);
      if (vRes.ok) {
        const v = await vRes.json() as { version: string };
        setCurrentVersion(v.version);
        setVersionInput(v.version);
      }
      if (uRes.ok) {
        const u = await uRes.json() as AdminUser[];
        setUsers(u);
        setSelectedEmails(new Set(u.map((x) => x.email)));
      }
      if (nRes.ok) {
        const n = await nRes.json() as ReleaseNotification[];
        setNotifications(n);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ── Version release ── */
  async function handleRelease() {
    setVersionError("");
    setVersionSuccess("");
    if (!validateVersion(versionInput)) {
      setVersionError("Use format X.Y or X.Y.Z  (e.g. 6.0, 6.1, 7.0)");
      return;
    }
    setVersionSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/app-version`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ version: versionInput.trim() }),
      });
      const data = await res.json() as { version?: string; error?: string };
      if (!res.ok) { setVersionError(data.error ?? "Failed to release"); return; }
      setCurrentVersion(data.version!);
      setVersionSuccess(`Version ${data.version} released successfully.`);
      setTimeout(() => setVersionSuccess(""), 4000);
    } catch { setVersionError("Network error"); }
    finally { setVersionSaving(false); }
  }

  /* ── User selection ── */
  function toggleSelectAll() {
    if (selectAll) {
      setSelectAll(false);
      setSelectedEmails(new Set());
    } else {
      setSelectAll(true);
      setSelectedEmails(new Set(users.map((u) => u.email)));
    }
  }

  function toggleUser(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) { next.delete(email); } else { next.add(email); }
      const allSelected = users.every((u) => next.has(u.email));
      setSelectAll(allSelected);
      return next;
    });
  }

  /* ── Send notification ── */
  async function handleSend() {
    setComposeError("");
    setComposeSuccess("");
    if (!message.trim()) { setComposeError("Message is required"); return; }
    const emails = Array.from(selectedEmails);
    if (!emails.length) { setComposeError("Select at least one recipient"); return; }

    setComposeSending(true);
    try {
      const createRes = await fetch(`${API_BASE}/api/admin/release-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), recipientEmails: emails }),
      });
      const created = await createRes.json() as ReleaseNotification & { error?: string };
      if (!createRes.ok) { setComposeError(created.error ?? "Failed to create notification"); return; }

      const sendRes = await fetch(`${API_BASE}/api/admin/release-notifications/${created.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientEmails: emails }),
      });
      const sendData = await sendRes.json() as { notification?: ReleaseNotification; errors?: string[]; error?: string };
      if (!sendRes.ok) { setComposeError(sendData.error ?? "Failed to send"); return; }

      const failedCount = sendData.errors?.length ?? 0;
      if (failedCount) {
        setComposeSuccess(`Sent to ${emails.length - failedCount} of ${emails.length} recipients. ${failedCount} failed.`);
      } else {
        setComposeSuccess(`Notification sent to ${emails.length} recipient${emails.length !== 1 ? "s" : ""}.`);
      }
      setSubject("");
      setMessage("");
      setTimeout(() => setComposeSuccess(""), 6000);
      void load();
    } catch { setComposeError("Network error"); }
    finally { setComposeSending(false); }
  }

  /* ── Clone ── */
  async function handleClone(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/release-notifications/${id}/clone`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const cloned = await res.json() as ReleaseNotification;
      setSubject(cloned.subject);
      setMessage(cloned.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { /* ignore */ }
  }

  /* ── Delete ── */
  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/release-notifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  function suggestNextMinor() {
    const parts = currentVersion.split(".");
    if (parts.length >= 2) {
      const minor = parseInt(parts[1], 10);
      return `${parts[0]}.${minor + 1}`;
    }
    return currentVersion;
  }

  function suggestNextMajor() {
    const major = parseInt(currentVersion.split(".")[0], 10);
    return `${major + 1}.0`;
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <button className="admin-back-btn" onClick={() => setLocation("/")}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h1 className="admin-title">App Release Communication</h1>
        </div>
        <div className="admin-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button className="admin-back-btn" onClick={() => setLocation("/")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1 className="admin-title">App Release Communication</h1>
      </div>

      <div className="arc-grid">
        {/* ── Left: App Version ── */}
        <div className="arc-card">
          <div className="arc-card-header">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            App Version
          </div>

          <div className="arc-version-current">
            <span className="arc-version-label">Currently released</span>
            <span className="arc-version-badge">v{currentVersion}</span>
          </div>

          <div className="edit-field-group" style={{ marginTop: 16 }}>
            <label>New Version Number</label>
            <input
              type="text"
              value={versionInput}
              onChange={(e) => { setVersionInput(e.target.value); setVersionError(""); }}
              placeholder="e.g. 6.1"
              style={{ fontFamily: "monospace", fontSize: 15 }}
            />
          </div>

          <div className="arc-version-suggestions">
            <span className="arc-suggest-label">Quick pick:</span>
            <button type="button" className="arc-suggest-btn" onClick={() => setVersionInput(suggestNextMinor())}>
              {suggestNextMinor()} minor
            </button>
            <button type="button" className="arc-suggest-btn" onClick={() => setVersionInput(suggestNextMajor())}>
              {suggestNextMajor()} major
            </button>
          </div>

          {versionError && <p className="edit-modal-error" style={{ marginTop: 8 }}>{versionError}</p>}
          {versionSuccess && <p className="arc-success">{versionSuccess}</p>}

          <button
            type="button"
            className="arc-release-btn"
            onClick={handleRelease}
            disabled={versionSaving || versionInput.trim() === currentVersion}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L13 8M13 8L8 14M13 8H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {versionSaving ? "Releasing…" : "Release Version"}
          </button>
        </div>

        {/* ── Right: Compose Notification ── */}
        <div className="arc-card">
          <div className="arc-card-header">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M1.5 6l6.5 4 6.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Send Notification
          </div>

          <div className="edit-field-group">
            <label>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. QuoteBuilder v6.1 is here!"
            />
          </div>

          <div className="edit-field-group">
            <label>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your release notes or announcement here…"
              rows={6}
              style={{ resize: "vertical", minHeight: 120 }}
            />
          </div>

          <div className="edit-field-group">
            <label>Recipients</label>
            <div className="arc-users-list">
              <label className="arc-user-row arc-user-row--all">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                />
                <span className="arc-user-name">All Users ({users.length})</span>
              </label>
              {users.map((u) => (
                <label key={u.id} className="arc-user-row">
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(u.email)}
                    onChange={() => toggleUser(u.email)}
                  />
                  <span className="arc-user-name">{u.fullName}</span>
                  <span className="arc-user-email">{u.email}</span>
                  {u.role === "admin" && <span className="arc-user-role">admin</span>}
                </label>
              ))}
            </div>
          </div>

          {composeError && <p className="edit-modal-error">{composeError}</p>}
          {composeSuccess && <p className="arc-success">{composeSuccess}</p>}

          <button
            type="button"
            className="arc-send-btn"
            onClick={handleSend}
            disabled={composeSending}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L1 7l5 2m8-7L9 15l-3-6m8-7L6 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {composeSending ? "Sending…" : `Send to ${selectedEmails.size} recipient${selectedEmails.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {/* ── Notification History ── */}
      <div className="arc-history">
        <div className="arc-history-header">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Notification History
          <span className="arc-history-count">{notifications.length}</span>
        </div>

        {notifications.length === 0 ? (
          <div className="admin-empty-state">No notifications yet. Send one above to get started.</div>
        ) : (
          <div className="arc-history-table">
            <div className="arc-history-row arc-history-row--head">
              <div className="arc-col-subject">Subject / Message</div>
              <div className="arc-col-recipients">Recipients</div>
              <div className="arc-col-sent">Sent</div>
              <div className="arc-col-actions" />
            </div>
            {notifications.map((n) => (
              <div key={n.id} className="arc-history-row">
                <div className="arc-col-subject">
                  {n.subject && <strong style={{ display: "block", fontSize: 13, marginBottom: 2 }}>{n.subject}</strong>}
                  <span className="arc-msg-preview">{n.message.slice(0, 120)}{n.message.length > 120 ? "…" : ""}</span>
                </div>
                <div className="arc-col-recipients">
                  <span className="arc-recipients-badge">{n.recipientEmails.length} user{n.recipientEmails.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="arc-col-sent">
                  {n.sentAt ? (
                    <span className="arc-sent-date">{formatDate(n.sentAt)}</span>
                  ) : (
                    <span className="arc-draft-badge">Draft</span>
                  )}
                </div>
                <div className="arc-col-actions">
                  <button
                    type="button"
                    className="admin-action-btn"
                    onClick={() => handleClone(n.id)}
                    title="Clone into compose"
                  >
                    Clone
                  </button>
                  {deletingId === n.id ? (
                    <>
                      <button
                        type="button"
                        className="admin-action-btn danger"
                        onClick={() => handleDelete(n.id)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => setDeletingId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="admin-action-btn danger"
                      onClick={() => setDeletingId(n.id)}
                      title="Delete notification"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
