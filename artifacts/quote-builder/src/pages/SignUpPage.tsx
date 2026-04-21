import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import logo from "/logo.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type Step = "credentials" | "verify";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
      <path d="M10.73 10.73A2 2 0 0 0 12 14a2 2 0 0 0 1.27-3.27" />
    </svg>
  );
}

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();

  const [step, setStep] = useState<Step>("credentials");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim() }),
      });
      const data = await res.json() as { step?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      setStep("verify");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), code: code.trim().toUpperCase(), type: "register" }),
      });
      const data = await res.json() as { user?: object; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      await refetch();
      setLocation("/");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img src={logo} alt="Aloha Essential CPQ 3.0" className="auth-logo" />
        <span>Aloha Essential CPQ 3.0</span>
      </div>

      <div className="auth-form-card">
        {step === "credentials" ? (
          <form onSubmit={handleCredentials} noValidate>
            <h2 className="auth-form-title">Create an account</h2>
            <p className="auth-form-subtitle">Fill in the details below to get started</p>

            {error && <div className="auth-form-error">{error}</div>}

            <div className="auth-form-group">
              <label className="auth-form-label" htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                className="auth-form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                autoComplete="name"
                required
              />
            </div>

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
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
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
              {loading ? "Creating account…" : "Continue"}
            </button>

            <p className="auth-form-footer">
              Already have an account?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setLocation("/sign-in"); }}>
                Sign in
              </a>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} noValidate>
            <h2 className="auth-form-title">Verify your email</h2>
            <p className="auth-form-subtitle">
              We sent an 8-character code to <strong>{email}</strong>. Enter it below to activate your account.
            </p>

            {error && <div className="auth-form-error">{error}</div>}

            <div className="auth-form-group">
              <label className="auth-form-label" htmlFor="code">Verification code</label>
              <input
                id="code"
                ref={codeRef}
                type="text"
                className="auth-form-input auth-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                maxLength={8}
                autoComplete="one-time-code"
                spellCheck={false}
                required
              />
            </div>

            <button type="submit" className="auth-form-submit" disabled={loading || code.length !== 8}>
              {loading ? "Verifying…" : "Verify & Create account"}
            </button>

            <p className="auth-form-footer">
              <a href="#" onClick={(e) => { e.preventDefault(); setStep("credentials"); setCode(""); setError(""); }}>
                ← Back
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
