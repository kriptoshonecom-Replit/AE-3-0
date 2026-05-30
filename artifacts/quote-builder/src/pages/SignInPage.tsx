import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import logo from "/logo.png";
import AuthSpinner from "@/components/AuthSpinner";
import { Eye, EyeOff } from "lucide-react";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function EyeIcon({ open }: { open: boolean }) {
  return open ? <Eye size={18} /> : <EyeOff size={18} />;
}

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showForgotModal, setShowForgotModal] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json() as { user?: object; error?: string };
      if (!res.ok) {
        setFailCount((n) => n + 1);
        setError(data.error ?? "Sign in failed");
        return;
      }
      setFailCount(0);
      await refetch();
      setLocation("/");
    } catch {
      setFailCount((n) => n + 1);
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthSpinner />
      <div className="auth-brand">
        <img src={logo} alt="Aloha WebCalculator" className="auth-logo" />
        <span>Aloha WebCalculator</span>
      </div>

      <div className="auth-form-card">
        <form onSubmit={handleSubmit} noValidate>
          <h2 className="auth-form-title">Sign in</h2>
          <p className="auth-form-subtitle">Enter your email and password to continue</p>

          {error && (
            <div className="auth-form-error">
              {error}
              {failCount >= 3 && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--accent)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                    onClick={() => setShowForgotModal(true)}
                  >
                    Forgot your password?
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="auth-form-group">
            <label className="auth-form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="auth-form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-form-group">
            <label className="auth-form-label" htmlFor="password">Password</label>
            <div className="auth-pw-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="auth-form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-pw-eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <button type="submit" className="auth-form-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="auth-form-footer">
            Don't have an account?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setLocation("/sign-up"); }}>
              Sign up
            </a>
          </p>
        </form>
      </div>

      {showForgotModal && (
        <ForgotPasswordModal
          prefillEmail={email}
          onClose={() => setShowForgotModal(false)}
        />
      )}
    </div>
  );
}
