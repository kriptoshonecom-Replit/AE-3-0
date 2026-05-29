import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { Eye, EyeOff, Check, Mail, X, Search, RefreshCw, Pencil, Trash2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

function pwChecks(pw: string) {
  return {
    length: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? <Eye size={15} /> : <EyeOff size={15} />;
}

interface NewUserModalProps {
  onClose: () => void;
  onCreated: (u: AdminUser) => void;
}

function NewUserModal({ onClose, onCreated }: NewUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = pwChecks(password);
  const pwValid = checks.length && checks.letter && checks.number && checks.special;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPwTouched(true);
    if (!fullName.trim() || !email.trim()) { setError("Full name and email are required"); return; }
    if (!pwValid) { setError("Password does not meet the requirements"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password, role }),
      });
      const data = await res.json() as AdminUser & { error?: string };
      if (!res.ok) { setError((data as { error?: string }).error ?? "Failed to create user"); return; }
      onCreated(data);
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>New User</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <form className="admin-modal-body" onSubmit={handleCreate} noValidate>
          {error && <div className="edit-modal-error">{error}</div>}

          <div className="admin-form-row">
            <div className="edit-field-group">
              <label htmlFor="nu-name">Full name</label>
              <input
                id="nu-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </div>
            <div className="edit-field-group">
              <label htmlFor="nu-email">Email</label>
              <input
                id="nu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="edit-field-group">
            <label htmlFor="nu-role">Role</label>
            <select id="nu-role" className="admin-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">Read Only (User)</option>
              <option value="admin">Read &amp; Write (Admin)</option>
            </select>
          </div>

          <div className="edit-field-group">
            <label htmlFor="nu-pw">Password</label>
            <div className="auth-pw-wrap">
              <input
                id="nu-pw"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwTouched(true); }}
                placeholder="Set an initial password"
                autoComplete="new-password"
              />
              <button type="button" className="auth-pw-eye" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                aria-label={showPw ? "Hide password" : "Show password"}>
                <EyeIcon open={showPw} />
              </button>
            </div>
            {(pwTouched || password.length > 0) && (
              <ul className="auth-pw-rules" style={{ marginTop: 6 }}>
                <li className={checks.length ? "pw-ok" : "pw-fail"}>
                  <Check size={11} />
                  At least 8 characters
                </li>
                <li className={checks.letter ? "pw-ok" : "pw-fail"}>
                  <Check size={11} />
                  At least one letter
                </li>
                <li className={checks.number ? "pw-ok" : "pw-fail"}>
                  <Check size={11} />
                  At least one number
                </li>
                <li className={checks.special ? "pw-ok" : "pw-fail"}>
                  <Check size={11} />
                  At least one special character
                </li>
              </ul>
            )}
            <p className="nu-email-note">
              <Mail size={12} />
              Login credentials will be emailed to the user after account creation.
            </p>
          </div>

          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="edit-modal-save" disabled={loading}>
              {loading ? "Creating…" : "Create user & send email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditUserModalProps {
  user: AdminUser;
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
}

function EditUserModal({ user, onClose, onSaved }: EditUserModalProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = pwChecks(newPw);
  const changingPw = newPw.length > 0;
  const pwValid = checks.length && checks.letter && checks.number && checks.special;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (changingPw && !pwValid) { setError("Password doesn't meet the requirements"); return; }

    const body: Record<string, string> = {};
    if (fullName.trim() !== user.fullName) body.fullName = fullName.trim();
    if (email.trim().toLowerCase() !== user.email) body.email = email.trim();
    if (role !== user.role) body.role = role;
    if (changingPw) body.newPassword = newPw;
    if (Object.keys(body).length === 0) { setError("No changes to save"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json() as AdminUser & { error?: string };
      if (!res.ok) { setError(data.error ?? "Update failed"); return; }
      onSaved(data);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>Edit User</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSave} noValidate>
          {error && <div className="edit-modal-error">{error}</div>}

          <div className="admin-form-row">
            <div className="edit-field-group">
              <label>Full name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="edit-field-group">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="edit-field-group">
            <label>Role</label>
            <select className="admin-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">Read Only (User)</option>
              <option value="admin">Read & Write (Admin)</option>
            </select>
          </div>

          <div className="edit-modal-divider" />

          <div className="edit-field-group">
            <label>New password <span className="edit-modal-optional">(optional — leave blank to keep current)</span></label>
            <div className="auth-pw-wrap">
              <input
                type={showPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Set a new password…"
                autoComplete="new-password"
              />
              <button type="button" className="auth-pw-eye" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                <EyeIcon open={showPw} />
              </button>
            </div>
            {changingPw && (
              <ul className="auth-pw-rules" style={{ marginTop: 6 }}>
                <li className={checks.length ? "pw-ok" : "pw-fail"}>
                  <Check size={11} /> At least 8 characters
                </li>
                <li className={checks.letter ? "pw-ok" : "pw-fail"}>
                  <Check size={11} /> At least one letter
                </li>
                <li className={checks.number ? "pw-ok" : "pw-fail"}>
                  <Check size={11} /> At least one number
                </li>
                <li className={checks.special ? "pw-ok" : "pw-fail"}>
                  <Check size={11} /> At least one special character
                </li>
              </ul>
            )}
          </div>

          <div className="edit-modal-footer">
            <button type="button" className="edit-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="edit-modal-save" disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [, setLocation] = useLocation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, { credentials: "include" });
      if (!res.ok) { setError("Failed to load users"); return; }
      setUsers(await res.json() as AdminUser[]);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(u: AdminUser) {
    if (!window.confirm(`Delete user ${u.fullName} (${u.email})? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${u.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const d = await res.json() as { error?: string }; alert(d.error ?? "Delete failed"); return; }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch { alert("Network error"); }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.includes(q);
  });

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">Users</h1>
        <div className="admin-topbar-right">
          <span className="admin-badge">{users.length} total</span>
          <button
            className="admin-btn-add-secondary"
            onClick={() => void load()}
            disabled={loading}
            title="Reload user list"
          >
            <RefreshCw size={13} style={{ marginRight: 4 }} />
            Refresh
          </button>
          <button className="edit-modal-save" style={{ padding: "7px 14px", fontSize: "13px" }} onClick={() => setCreatingNew(true)}>
            New User
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-toolbar">
          <div className="ql-search-wrap admin-search">
            <Search size={13} className="ql-search-icon" />
            <input
              type="text"
              className="ql-search"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading && <div className="admin-loading"><div className="spinner" /></div>}
        {error && <div className="edit-modal-error">{error}</div>}

        {!loading && !error && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Member Since</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="admin-table-empty">No users found</td></tr>
                )}
                {filtered.map((u) => (
                  <tr key={u.id} className={u.id === me?.id ? "admin-row-self" : ""}>
                    <td className="admin-td-name">
                      <div className="admin-user-avatar-sm">{u.fullName[0]?.toUpperCase()}</div>
                      {u.fullName}
                      {u.id === me?.id && <span className="admin-you-tag">You</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`admin-role-badge ${u.role === "admin" ? "role-admin" : "role-user"}`}>
                        {u.role === "admin" ? "Admin" : "Read Only"}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
                    <td>
                      <div className="admin-actions">
                        <button className="admin-btn-edit" onClick={() => setEditing(u)} title="Edit user">
                          <Pencil size={13} />
                          Edit
                        </button>
                        {u.id !== me?.id && (
                          <button className="admin-btn-delete" onClick={() => handleDelete(u)} title="Delete user">
                            <Trash2 size={13} />
                            Delete
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

      {creatingNew && (
        <NewUserModal
          onClose={() => setCreatingNew(false)}
          onCreated={(newUser) => setUsers((prev) => [...prev, newUser])}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))}
        />
      )}
    </div>
  );
}
