import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import logo from "/logo.png";
import AuthSpinner from "@/components/AuthSpinner";
import { Eye, EyeOff, Check } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function EyeIcon({ open }: { open: boolean }) {
  return open ? <Eye size={18} /> : <EyeOff size={18} />;
}

function CheckIcon() {
  return <Check size={12} />;
}

function pwChecks(pw: string) {
  return {
    length: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = pwChecks(password);
  const pwValid = checks.length && checks.letter && checks.number && checks.special;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPwTouched(true);

    if (!pwValid) {
      setError("Password does not meet the requirements below");
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
      const data = await res.json() as { user?: object; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
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
      <AuthSpinner />
      <div className="auth-brand">
        <img src={logo} alt="Aloha WebCalculator" className="auth-logo" />
        <span>Aloha WebCalculator</span>
      </div>

      <div className="auth-form-card">
        <form onSubmit={handleSubmit} noValidate>
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
                onChange={(e) => { setPassword(e.target.value); setPwTouched(true); }}
                placeholder="Create a strong password"
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

            {(pwTouched || password.length > 0) && (
              <ul className="auth-pw-rules">
                <li className={checks.length ? "pw-ok" : "pw-fail"}>
                  <CheckIcon /> At least 8 characters
                </li>
                <li className={checks.letter ? "pw-ok" : "pw-fail"}>
                  <CheckIcon /> At least one letter
                </li>
                <li className={checks.number ? "pw-ok" : "pw-fail"}>
                  <CheckIcon /> At least one number
                </li>
                <li className={checks.special ? "pw-ok" : "pw-fail"}>
                  <CheckIcon /> At least one special character
                </li>
              </ul>
            )}
          </div>

          <button type="submit" className="auth-form-submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="auth-form-footer">
            Already have an account?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setLocation("/sign-in"); }}>
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
