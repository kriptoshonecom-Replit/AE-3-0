import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import logo from "/logo.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type Step = "credentials" | "verify";

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  async function handleCredentials(e: React.FormEvent) {
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
      const data = await res.json() as { step?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
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
        body: JSON.stringify({ email: email.trim(), code: code.trim().toUpperCase(), type: "login" }),
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
            <h2 className="auth-form-title">Sign in</h2>
            <p className="auth-form-subtitle">Enter your email and password to continue</p>

            {error && <div className="auth-form-error">{error}</div>}

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
              <input
                id="password"
                type="password"
                className="auth-form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="auth-form-submit" disabled={loading}>
              {loading ? "Signing in…" : "Continue"}
            </button>

            <p className="auth-form-footer">
              Don't have an account?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setLocation("/sign-up"); }}>
                Sign up
              </a>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} noValidate>
            <h2 className="auth-form-title">Check your email</h2>
            <p className="auth-form-subtitle">
              We sent an 8-character code to <strong>{email}</strong>. Enter it below to sign in.
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
              {loading ? "Verifying…" : "Verify & Sign in"}
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
