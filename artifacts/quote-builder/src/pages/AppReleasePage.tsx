import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { RichTextEditor, RichTextDisplay, stripHtml } from "@/components/RichTextEditor";
import { Clock, ArrowRight, Mail, Copy, Trash2 } from "lucide-react";

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

  const [currentVersion, setCurrentVersion] = useState("6.0");
  const [versionInput, setVersionInput] = useState("6.0");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("Refresh your browser to make sure you are viewing the latest version.");
  const [selectAll, setSelectAll] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notifications, setNotifications] = useState<ReleaseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const versionTrimmed = versionInput.trim();
  const versionWillChange = versionTrimmed !== currentVersion && versionTrimmed !== "";

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
      setSelectAll(users.every((u) => next.has(u.email)));
      return next;
    });
  }

  async function handleSend() {
    setError("");
    setSuccess("");

    if (!stripHtml(message).trim()) { setError("Message is required"); return; }
    const emails = Array.from(selectedEmails);
    if (!emails.length) { setError("Select at least one recipient"); return; }
    if (versionWillChange && !validateVersion(versionTrimmed)) {
      setError("Version must be in format X.Y or X.Y.Z (e.g. 6.1, 7.0)");
      return;
    }

    setSending(true);
    try {
      if (versionWillChange) {
        const vRes = await fetch(`${API_BASE}/api/admin/app-version`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ version: versionTrimmed }),
        });
        const vData = await vRes.json() as { version?: string; error?: string };
        if (!vRes.ok) { setError(vData.error ?? "Failed to release version"); return; }
        setCurrentVersion(vData.version!);
      }

      const createRes = await fetch(`${API_BASE}/api/admin/release-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), recipientEmails: emails }),
      });
      const created = await createRes.json() as ReleaseNotification & { error?: string };
      if (!createRes.ok) { setError(created.error ?? "Failed to create notification"); return; }

      const sendRes = await fetch(`${API_BASE}/api/admin/release-notifications/${created.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientEmails: emails }),
      });
      const sendData = await sendRes.json() as { notification?: ReleaseNotification; errors?: string[]; error?: string };
      if (!sendRes.ok) { setError(sendData.error ?? "Failed to send"); return; }

      const failCount = sendData.errors?.length ?? 0;
      const parts: string[] = [];
      if (versionWillChange) parts.push(`Version ${versionTrimmed} released.`);
      parts.push(failCount
        ? `Sent to ${emails.length - failCount} of ${emails.length} recipients (${failCount} failed).`
        : `Notification sent to ${emails.length} recipient${emails.length !== 1 ? "s" : ""}.`
      );
      setSuccess(parts.join(" "));
      setSubject("");
      setMessage("");
      setTimeout(() => setSuccess(""), 6000);
      void load();
    } catch { setError("Network error — please try again"); }
    finally { setSending(false); }
  }

  async function handleClone(n: ReleaseNotification) {
    setSubject(n.subject);
    setMessage(n.message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/release-notifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  function suggestMinor() {
    const parts = currentVersion.split(".");
    return parts.length >= 2 ? `${parts[0]}.${parseInt(parts[1], 10) + 1}` : currentVersion;
  }
  function suggestMajor() {
    return `${parseInt(currentVersion.split(".")[0], 10) + 1}.0`;
  }

  const btnLabel = sending
    ? "Sending…"
    : versionWillChange
      ? `Send & Release v${versionTrimmed}`
      : "Send Notification";

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">App Release Communication</h1>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="admin-loading"><div className="spinner" /></div>
        ) : (
          <>
            <div className="arc-compose-grid">
              {/* ── Version ── */}
              <div className="admin-table-wrap arc-panel">
                <div className="arc-panel-heading">
                  <Clock size={14} />
                  App Version
                </div>

                <div className="arc-version-row">
                  <span className="arc-version-label">Currently released</span>
                  <span className="arc-version-num">v{currentVersion}</span>
                </div>

                <div className="edit-field-group">
                  <label>
                    New version
                    <span className="edit-modal-optional"> — leave unchanged to skip version update</span>
                  </label>
                  <input
                    type="text"
                    value={versionInput}
                    onChange={(e) => { setVersionInput(e.target.value); setError(""); }}
                    placeholder="e.g. 6.1"
                    style={{ fontFamily: "monospace" }}
                  />
                </div>

                <div className="arc-suggest-row">
                  <span className="arc-suggest-label">Quick pick:</span>
                  <button type="button" className="admin-btn-add-secondary" onClick={() => setVersionInput(suggestMinor())}>
                    {suggestMinor()} minor
                  </button>
                  <button type="button" className="admin-btn-add-secondary" onClick={() => setVersionInput(suggestMajor())}>
                    {suggestMajor()} major
                  </button>
                </div>

                {versionWillChange && (
                  <div className="arc-version-hint">
                    <ArrowRight size={12} />
                    Version will be released when you send
                  </div>
                )}
              </div>

              {/* ── Compose ── */}
              <div className="admin-table-wrap arc-panel">
                <div className="arc-panel-heading">
                  <Mail size={14} />
                  Compose Notification
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
                  <RichTextEditor
                    value={message}
                    onChange={setMessage}
                    placeholder="Write your release notes or announcement here…"
                    minHeight={110}
                  />
                </div>

                <div className="edit-field-group">
                  <label>Recipients</label>
                  <div className="arc-users-list">
                    <label className="arc-user-row arc-user-row--all">
                      <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                      <span className="arc-user-name">All Users ({users.length})</span>
                    </label>
                    {users.map((u) => (
                      <label key={u.id} className="arc-user-row">
                        <input type="checkbox" checked={selectedEmails.has(u.email)} onChange={() => toggleUser(u.email)} />
                        <span className="arc-user-name">{u.fullName}</span>
                        <span className="arc-user-email">{u.email}</span>
                        {u.role === "admin" && <span className="arc-user-role">admin</span>}
                      </label>
                    ))}
                  </div>
                </div>

                {error && <div className="edit-modal-error">{error}</div>}
                {success && <div className="arc-success">{success}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="button"
                    className="edit-modal-save"
                    style={{ padding: "9px 20px", fontSize: 13 }}
                    onClick={handleSend}
                    disabled={sending}
                  >
                    {btnLabel}
                  </button>
                </div>
              </div>
            </div>

            {/* ── History ── */}
            <div style={{ marginTop: 24 }}>
              <div className="admin-toolbar">
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                  Notification History
                </h2>
                <span className="admin-badge">{notifications.length}</span>
              </div>

              <div className="admin-table-wrap">
                {notifications.length === 0 ? (
                  <div className="admin-table-empty" style={{ padding: 28 }}>
                    No notifications sent yet. Use the compose form above to send your first one.
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Subject / Message</th>
                        <th>Recipients</th>
                        <th>Sent</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.map((n) => (
                        <tr key={n.id}>
                          <td style={{ maxWidth: 340 }}>
                            {n.subject && (
                              <div className="admin-td-bold" style={{ marginBottom: 2 }}>{n.subject}</div>
                            )}
                            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                              <RichTextDisplay html={n.message} />
                            </div>
                          </td>
                          <td>
                            <span className="admin-badge">{n.recipientEmails.length} user{n.recipientEmails.length !== 1 ? "s" : ""}</span>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {n.sentAt ? (
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(n.sentAt)}</span>
                            ) : (
                              <span className="arc-draft-badge">Draft</span>
                            )}
                          </td>
                          <td>
                            <div className="admin-actions">
                              <button
                                className="admin-btn-edit"
                                onClick={() => handleClone(n)}
                                title="Copy into compose"
                              >
                                <Copy size={12} />
                                Clone
                              </button>
                              {deletingId === n.id ? (
                                <>
                                  <button className="admin-btn-delete" onClick={() => handleDelete(n.id)}>Confirm</button>
                                  <button className="admin-btn-edit" onClick={() => setDeletingId(null)}>Cancel</button>
                                </>
                              ) : (
                                <button className="admin-btn-delete" onClick={() => setDeletingId(n.id)}>
                                  <Trash2 size={12} />
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
