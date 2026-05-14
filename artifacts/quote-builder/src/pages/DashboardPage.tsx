import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface KPIs {
  totalPipelineValue: number;
  totalQuotes: number;
  quotesThisMonth: number;
  passRate: number;
  passCount: number;
  failCount: number;
  avgQuoteValue: number;
}

interface RepStat {
  name: string;
  quotes: number;
  value: number;
  pass: number;
}

interface CustomerStat {
  name: string;
  value: number;
  sites: number;
}

interface MonthlyPoint {
  month: string;
  value: number;
}

interface PitStat {
  label: string;
  count: number;
}

interface ActivityItem {
  action: string;
  rep: string;
  dot: string;
  time: string;
}

interface RecentQuote {
  id: string;
  quoteNumber: string;
  companyName: string;
  customerName: string;
  salesRep: string;
  value: number;
  passStatus: string | null;
  updatedAt: string;
  addressState: string | null;
  addressCountry: string | null;
}

interface DashboardData {
  kpis: KPIs;
  topReps: RepStat[];
  topCustomers: CustomerStat[];
  monthlyData: MonthlyPoint[];
  pitDistribution: PitStat[];
  recentActivity: ActivityItem[];
  recentQuotes: RecentQuote[];
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const REP_COLORS = ["#7c3aed", "#0ea5e9", "#22c55e", "#f97316", "#ec4899", "#14b8a6"];
const PIT_COLORS: Record<string, string> = {
  Standard: "#7c3aed",
  Premium: "#0ea5e9",
  None: "#cbd5e1",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/dashboard`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json() as Promise<DashboardData>;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load dashboard data."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, color: "#ef4444", fontFamily: "Inter, sans-serif" }}>{error ?? "No data"}</div>
    );
  }

  const { kpis, topReps, topCustomers, monthlyData, pitDistribution, recentActivity, recentQuotes } = data;
  const maxBar = Math.max(...monthlyData.map((d) => d.value), 1);
  const pitTotal = pitDistribution.reduce((s, p) => s + p.count, 0) || 1;

  const kpiCards = [
    {
      label: "Total Pipeline Value",
      value: fmt(kpis.totalPipelineValue),
      sub: `across ${kpis.totalQuotes} quotes`,
      color: "#7c3aed",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L3 7v11h5v-5h4v5h5V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: "Quotes This Month",
      value: String(kpis.quotesThisMonth),
      sub: `${kpis.totalQuotes} total all time`,
      color: "#0ea5e9",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Pass Rate",
      value: `${kpis.passRate}%`,
      sub: `${kpis.passCount} passed · ${kpis.failCount} failed`,
      color: "#22c55e",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: "Avg Quote Value",
      value: fmt(kpis.avgQuoteValue),
      sub: "per quote (MRR)",
      color: "#f97316",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3v14M7 6h4.5a2.5 2.5 0 0 1 0 5H7m0 0h5.5a2.5 2.5 0 0 1 0 5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="admin-page-wrapper">
      <div className="admin-page-inner" style={{ maxWidth: 1300 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1e293b" }}>Dashboard</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              Quote pipeline performance overview ·{" "}
              {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setLocation("/admin/quote-library")}
          >
            View Quote Library →
          </button>
        </div>

        {/* KPI cards */}
        <div className="dashboard-kpi-grid">
          {kpiCards.map((card) => (
            <div key={card.label} className="dashboard-kpi-card">
              <div className="dashboard-kpi-header">
                <span className="dashboard-kpi-label">{card.label}</span>
                <span style={{ color: card.color, opacity: 0.75 }}>{card.icon}</span>
              </div>
              <div className="dashboard-kpi-value">{card.value}</div>
              <div className="dashboard-kpi-sub">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Row 2: Recent Quotes + Sidebar */}
        <div className="dashboard-main-row">

          {/* Recent Quotes Table */}
          <div className="dashboard-card" style={{ flex: 1, minWidth: 0 }}>
            <div className="dashboard-card-header">
              <span className="dashboard-card-title">Recent Quotes</span>
              <button type="button" className="dashboard-link-btn" onClick={() => setLocation("/admin/quote-library")}>
                View all →
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    {["Quote #", "Company", "Location", "Sales Rep", "Value", "Status", "Updated"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>
                        No quotes yet
                      </td>
                    </tr>
                  ) : (
                    recentQuotes.map((q) => {
                      const st = q.passStatus?.toLowerCase();
                      const location = [q.addressState, q.addressCountry].filter(Boolean).join(", ") || "—";
                      return (
                        <tr key={q.id}>
                          <td style={{ fontWeight: 600, color: "#7c3aed" }}>{q.quoteNumber}</td>
                          <td style={{ fontWeight: 500 }}>{q.companyName}</td>
                          <td style={{ color: "#64748b" }}>{location}</td>
                          <td style={{ color: "#64748b" }}>{q.salesRep}</td>
                          <td style={{ fontWeight: 700 }}>{fmt(q.value)}</td>
                          <td>
                            {st === "pass" && <span className="badge-pass">PASS</span>}
                            {st === "fail" && <span className="badge-fail">FAIL</span>}
                            {!st && <span className="badge-pending">PENDING</span>}
                          </td>
                          <td style={{ color: "#94a3b8" }}>{timeAgo(q.updatedAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar */}
          <div className="dashboard-sidebar-col">

            {/* Sales Reps */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">Quotes by Sales Rep</span>
              </div>
              {topReps.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No data yet</p>
              ) : (
                topReps.map((r, i) => {
                  const color = REP_COLORS[i % REP_COLORS.length];
                  const initials = r.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  const maxVal = topReps[0]?.value || 1;
                  return (
                    <div key={r.name} className="dashboard-rep-row">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="dashboard-rep-avatar" style={{ background: color + "20", color }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {r.quotes} quote{r.quotes !== 1 ? "s" : ""} · {r.pass} passed
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fmt(r.value)}</span>
                      </div>
                      <div className="dashboard-progress-bg">
                        <div className="dashboard-progress-fill" style={{ width: `${(r.value / maxVal) * 100}%`, background: color }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* PIT Distribution */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">PIT Type Distribution</span>
              </div>
              <div className="dashboard-pit-bar">
                {pitDistribution.map((p) => (
                  <div
                    key={p.label}
                    style={{ flex: p.count / pitTotal, background: PIT_COLORS[p.label] ?? "#94a3b8" }}
                  />
                ))}
              </div>
              {pitDistribution.map((p) => (
                <div key={p.label} className="dashboard-pit-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div className="dashboard-pit-dot" style={{ background: PIT_COLORS[p.label] ?? "#94a3b8" }} />
                    <span style={{ fontSize: 12, color: "#475569" }}>{p.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{p.count}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{Math.round((p.count / pitTotal) * 100)}%</span>
                  </div>
                </div>
              ))}
              {pitDistribution.length === 0 && (
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Pipeline chart + Top Customers + Activity */}
        <div className="dashboard-bottom-row">

          {/* Monthly Pipeline */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-title">Monthly Pipeline</span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>MRR value of quotes created</div>
            <div className="dashboard-bar-chart">
              {monthlyData.map((d, i) => (
                <div key={d.month} className="dashboard-bar-col">
                  <div
                    className="dashboard-bar"
                    style={{
                      height: `${(d.value / maxBar) * 88}px`,
                      background: i === monthlyData.length - 1 ? "#7c3aed" : "#ddd6fe",
                    }}
                  />
                  <span className="dashboard-bar-label">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Customers */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-title">Top Customers by Value</span>
            </div>
            {topCustomers.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No data yet</p>
            ) : (
              topCustomers.map((c, i) => (
                <div key={c.name} className="dashboard-customer-row">
                  <div className="dashboard-customer-rank" style={{ background: i === 0 ? "#ede9fe" : "#f1f5f9", color: i === 0 ? "#7c3aed" : "#64748b" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {c.sites} quote{c.sites !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#7c3aed" : "#1e293b", flexShrink: 0 }}>
                    {fmt(c.value)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Recent Activity */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-title">Recent Activity</span>
            </div>
            {recentActivity.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No activity yet</p>
            ) : (
              recentActivity.map((a, i) => (
                <div key={i} className="dashboard-activity-row">
                  <div className="dashboard-activity-dot" style={{ background: a.dot }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{a.action}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {a.rep} · {timeAgo(a.time)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
