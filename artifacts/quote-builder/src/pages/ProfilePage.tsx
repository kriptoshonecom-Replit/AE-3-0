import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
      <path d="M10.73 10.73A2 2 0 0 0 12 14a2 2 0 0 0 1.27-3.27" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function pwChecks(pw: string) {
  return {
    length: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

interface EditModalProps {
  user: { fullName: string; email: string };
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ user, onClose, onSaved }: EditModalProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = pwChecks(newPw);
  const newPwValid = checks.length && checks.letter && checks.number && checks.special;
  const changingPw = newPw.length > 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (changingPw && !newPwValid) {
      setError("New password doesn't meet the requirements");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (fullName.trim() !== user.fullName) body.fullName = fullName.trim();
      if (email.trim().toLowerCase() !== user.email) body.email = email.trim();
      if (changingPw) { body.currentPassword = currentPw; body.newPassword = newPw; }

      if (Object.keys(body).length === 0) {
        setError("No changes to save");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json() as { user?: object; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setSuccess("Account updated!");
      await onSaved();
      setTimeout(onClose, 900);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="edit-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="edit-modal">
        <div className="edit-modal-header">
          <h3>Edit Account</h3>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} noValidate className="edit-modal-body">
          {error && <div className="edit-modal-error">{error}</div>}
          {success && <div className="edit-modal-success">{success}</div>}

          <div className="edit-modal-section">
            <p className="edit-modal-section-label">Profile</p>
            <div className="edit-field-group">
              <label htmlFor="em-name">Full name</label>
              <input
                id="em-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </div>
            <div className="edit-field-group">
              <label htmlFor="em-email">Email</label>
              <input
                id="em-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="edit-modal-divider" />

          <div className="edit-modal-section">
            <p className="edit-modal-section-label">Change password <span className="edit-modal-optional">(optional)</span></p>
            <div className="edit-field-group">
              <label htmlFor="em-cpw">Current password</label>
              <div className="auth-pw-wrap">
                <input
                  id="em-cpw"
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" className="auth-pw-eye" onClick={() => setShowCurrent(v => !v)} tabIndex={-1}>
                  <EyeIcon open={showCurrent} />
                </button>
              </div>
            </div>
            <div className="edit-field-group">
              <label htmlFor="em-npw">New password</label>
              <div className="auth-pw-wrap">
                <input
                  id="em-npw"
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <button type="button" className="auth-pw-eye" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
                  <EyeIcon open={showNew} />
                </button>
              </div>
              {changingPw && (
                <ul className="auth-pw-rules" style={{ marginTop: 6 }}>
                  <li className={checks.length ? "pw-ok" : "pw-fail"}><CheckIcon /> At least 8 characters</li>
                  <li className={checks.letter ? "pw-ok" : "pw-fail"}><CheckIcon /> At least one letter</li>
                  <li className={checks.number ? "pw-ok" : "pw-fail"}><CheckIcon /> At least one number</li>
                  <li className={checks.special ? "pw-ok" : "pw-fail"}><CheckIcon /> At least one special character</li>
                </ul>
              )}
            </div>
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

export default function ProfilePage() {
  const { user, isLoaded, signOut, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const [showEdit, setShowEdit] = useState(false);

  if (!isLoaded) {
    return (
      <div className="profile-loading">
        <div className="spinner" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  const [firstName, ...lastParts] = (user?.fullName ?? "").split(" ");
  const lastName = lastParts.join(" ");

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            <span>{initials}</span>
          </div>
          <div className="profile-info">
            <h2>{user?.fullName || "Your Account"}</h2>
            <p>{user?.email}</p>
          </div>
          <button
            className="profile-edit-btn"
            type="button"
            onClick={() => setShowEdit(true)}
            title="Edit account"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>
        </div>

        <div className="profile-details">
          <div className="profile-field">
            <label>First name</label>
            <span>{firstName || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Last name</label>
            <span>{lastName || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Email</label>
            <span>{user?.email || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Member since</label>
            <span>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                : "—"}
            </span>
          </div>
        </div>

        <div className="profile-actions">
          <button className="btn-ghost" type="button" onClick={() => setLocation("/")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Quotes
          </button>
          <button className="btn-signout" type="button" onClick={handleSignOut}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2h3v10H9M6 4.5L3 7l3 2.5M3 7h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      </div>

      {showEdit && user && (
        <EditModal
          user={{ fullName: user.fullName, email: user.email }}
          onClose={() => setShowEdit(false)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
