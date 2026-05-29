import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { Eye, EyeOff, Check, X, Pencil, ChevronLeft, LogOut } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function EyeIcon({ open }: { open: boolean }) {
  return open ? <Eye size={16} /> : <EyeOff size={16} />;
}

function CheckIcon() {
  return <Check size={11} />;
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
            <X size={15} />
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

interface QuoteStats {
  total: number;
  passCount: number;
  failCount: number;
  passMrr: number;
  passArr: number;
  totalMrr: number;
  totalArr: number;
  successRate: number;
  passRequestedMonthly: number;
  failRequestedMonthly: number;
  passRequestedUpfront: number;
  failRequestedUpfront: number;
  passPaymentsRevMo: number;
  passGatewayRevMo: number;
  totalPaymentsRevMo: number;
  totalGatewayRevMo: number;
  passTotalSites: number;
  allTotalSites: number;
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function PaymentsRevenueStats({ stats, loading }: { stats: QuoteStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="profile-stats">
        <p className="profile-stats-title">Payments Processing</p>
        <div className="profile-stats-loading"><div className="spinner" /></div>
      </div>
    );
  }
  if (!stats) return null;

  const passPaymentsPerSite = stats.passTotalSites > 0
    ? stats.passPaymentsRevMo / stats.passTotalSites : 0;
  const passGatewayPerSite = stats.passTotalSites > 0
    ? stats.passGatewayRevMo / stats.passTotalSites : 0;
  const allPaymentsPerSite = stats.allTotalSites > 0
    ? stats.totalPaymentsRevMo / stats.allTotalSites : 0;
  const allGatewayPerSite = stats.allTotalSites > 0
    ? stats.totalGatewayRevMo / stats.allTotalSites : 0;

  const hasData = stats.totalPaymentsRevMo > 0 || stats.totalGatewayRevMo > 0;
  if (!hasData) return null;

  return (
    <div className="profile-stats">
      <p className="profile-stats-title">Payments Processing</p>
      <div className="profile-stats-grid">
        <div className="profile-stat-card">
          <span className="profile-stat-label">Won Payments Rev</span>
          <span className="profile-stat-value psc-money">
            {fmtMoney(stats.passPaymentsRevMo)}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)" }}>/mo</span>
          </span>
          <span className="profile-stat-sub">{fmtMoney(passPaymentsPerSite)}/site · {stats.passTotalSites} site{stats.passTotalSites !== 1 ? "s" : ""}</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-label">Won Gateway Rev</span>
          <span className="profile-stat-value psc-gateway">
            {fmtMoney(stats.passGatewayRevMo)}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)" }}>/mo</span>
          </span>
          <span className="profile-stat-sub">{fmtMoney(passGatewayPerSite)}/site · {stats.passTotalSites} site{stats.passTotalSites !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

function ProfileStats({ stats, loading }: { stats: QuoteStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="profile-stats">
        <p className="profile-stats-title">Quote Performance</p>
        <div className="profile-stats-loading"><div className="spinner" /></div>
      </div>
    );
  }
  if (!stats) return null;

  const unset = stats.total - stats.passCount - stats.failCount;

  const totalReqMonthly = stats.passRequestedMonthly + stats.failRequestedMonthly;
  const totalReqUpfront = stats.passRequestedUpfront + stats.failRequestedUpfront;

  return (
    <div className="profile-stats">
      <p className="profile-stats-title">Quote Performance</p>
      <div className="profile-stats-grid">
        <div className="profile-stat-card">
          <span className="profile-stat-label">Won</span>
          <span className="profile-stat-value psc-pass">{stats.passCount}</span>
          <span className="profile-stat-sub">of {stats.total} quotes</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-label">Lost</span>
          <span className="profile-stat-value psc-fail">{stats.failCount}</span>
          <span className="profile-stat-sub">{unset} pending review</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-label">Success Rate</span>
          <span className="profile-stat-value psc-rate">{stats.successRate}%</span>
          <span className="profile-stat-sub">pass / total quotes</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-label">Won Value (ARR)</span>
          <span className="profile-stat-value psc-money">{fmtMoney(stats.passArr)}</span>
          <span className="profile-stat-sub">MRR {fmtMoney(stats.passMrr)} · pipeline {fmtMoney(stats.totalArr)}</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-label">Customer Requested Amount</span>
          <span className="profile-stat-value psc-money">
            {fmtMoney(totalReqMonthly)}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)" }}>/mo</span>
          </span>
          <span className="profile-stat-sub">{fmtMoney(totalReqMonthly * 12)} ARR</span>
          <div className="db-kpi-breakdown" style={{ marginTop: 4 }}>
            <span className="db-kpi-pass">Pass {fmtMoney(stats.passRequestedMonthly)}</span>
            <span className="db-kpi-fail">Fail {fmtMoney(stats.failRequestedMonthly)}</span>
          </div>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-label">Requested Upfront Amount</span>
          <span className="profile-stat-value psc-money">{fmtMoney(totalReqUpfront)}</span>
          <span className="profile-stat-sub">total one-time requested</span>
          <div className="db-kpi-breakdown" style={{ marginTop: 4 }}>
            <span className="db-kpi-pass">Pass {fmtMoney(stats.passRequestedUpfront)}</span>
            <span className="db-kpi-fail">Fail {fmtMoney(stats.failRequestedUpfront)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoaded, signOut, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [stats, setStats] = useState<QuoteStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    setStatsLoading(true);
    fetch(`${API_BASE}/api/quotes/stats`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() as Promise<QuoteStats> : Promise.reject())
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [isLoaded]);

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
            <Pencil size={12} />
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

        <ProfileStats stats={stats} loading={statsLoading} />
        <PaymentsRevenueStats stats={stats} loading={statsLoading} />

        <div className="profile-actions">
          <button className="btn-ghost" type="button" onClick={() => history.back()}>
            <ChevronLeft size={14} />
            Go Back
          </button>
          <button className="btn-signout" type="button" onClick={handleSignOut}>
            <LogOut size={14} />
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
