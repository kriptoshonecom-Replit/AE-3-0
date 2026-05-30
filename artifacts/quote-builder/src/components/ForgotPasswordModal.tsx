import { useState } from "react";
import { X, Mail, CheckCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface Props {
  prefillEmail?: string;
  onClose: () => void;
}

export default function ForgotPasswordModal({ prefillEmail = "", onClose }: Props) {
  const [email, setEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Request failed");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="admin-modal"
        style={{ maxWidth: 420, padding: "28px 32px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Forgot Password
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "4px 0 0" }}>
              {sent
                ? "Check your inbox for the new password."
                : "Enter your email and we'll send you a new temporary password."}
            </p>
          </div>
          <button
            type="button"
            className="edit-modal-close"
            onClick={onClose}
            aria-label="Close"
            style={{ marginTop: 2 }}
          >
            <X size={15} />
          </button>
        </div>

        {sent ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 12, padding: "24px 0 8px",
          }}>
            <CheckCircle size={40} color="var(--success)" />
            <p style={{ fontSize: 14, color: "var(--text)", textAlign: "center", margin: 0 }}>
              A temporary password has been sent to <strong>{email}</strong>.
              <br />Sign in with it, then update your password in Profile settings.
            </p>
            <button
              type="button"
              className="edit-modal-save"
              style={{ marginTop: 8, width: "100%" }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="edit-modal-error" style={{ marginBottom: 14 }}>{error}</div>
            )}
            <label className="lib-label" style={{ display: "block", marginBottom: 16 }}>
              Email address
              <div style={{ position: "relative", marginTop: 6 }}>
                <Mail size={14} style={{
                  position: "absolute", left: 10, top: "50%",
                  transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none",
                }} />
                <input
                  type="email"
                  className="lib-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  style={{ paddingLeft: 32 }}
                  required
                />
              </div>
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="edit-modal-cancel"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="edit-modal-save"
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? "Sending…" : "Send New Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
