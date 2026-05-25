import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import LocationCardsPanel, { type GeoPoint } from "@/components/LocationCardsPanel";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface KPIs {
  totalPipelineValue: number;
  totalMRR: number;
  totalQuotes: number;
  quotesThisMonth: number;
  passRate: number;
  passCount: number;
  failCount: number;
  avgQuoteValue: number;
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
  addressLine: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressCountry: string | null;
}

interface DashboardData {
  kpis: KPIs;
  amendments: { total: number; thisMonth: number };
  topReps: RepStat[];
  topCustomers: CustomerStat[];
  monthlyData: MonthlyPoint[];
  pitDistribution: PitStat[];
  recentActivity: ActivityItem[];
  recentQuotes: RecentQuote[];
  geoDistribution: { byState: GeoPoint[]; byCountry: GeoPoint[] };
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

  function load() {
    setLoading(true);
    fetch(`${API_BASE}/api/admin/dashboard`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json() as Promise<DashboardData>;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load dashboard data."); setLoading(false); });
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-topbar">
          <GlobalNavTrigger />
          <h1 className="admin-page-title">Dashboard</h1>
        </div>
        <div className="admin-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-page">
        <div className="admin-topbar">
          <GlobalNavTrigger />
          <h1 className="admin-page-title">Dashboard</h1>
        </div>
        <div className="admin-content">
          <p style={{ color: "var(--red, #ef4444)", fontSize: 14 }}>{error ?? "No data available."}</p>
        </div>
      </div>
    );
  }

  const { kpis, amendments, topReps, topCustomers, monthlyData, pitDistribution, recentActivity, recentQuotes, geoDistribution } = data;
  const maxBar = Math.max(...monthlyData.map((d) => d.value), 1);
  const pitTotal = pitDistribution.reduce((s, p) => s + p.count, 0) || 1;

  const kpiCards = [
    {
      label: "Total Pipeline (ARR)",
      value: fmt(kpis.totalPipelineValue),
      sub: `MRR ${fmt(kpis.totalMRR)} · ${kpis.totalQuotes} quotes`,
      color: "#7c3aed",
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
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
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
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
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: "Avg Quote Value",
      value: fmt(kpis.avgQuoteValue),
      sub: "per quote (ARR)",
      color: "#f97316",
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M10 3v14M7 6h4.5a2.5 2.5 0 0 1 0 5H7m0 0h5.5a2.5 2.5 0 0 1 0 5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const totalReqMonthly = kpis.passRequestedMonthly + kpis.failRequestedMonthly;
  const totalReqUpfront = kpis.passRequestedUpfront + kpis.failRequestedUpfront;

  return (
    <div className="admin-page">

      {/* ── Top bar ── */}
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">Dashboard</h1>
        <div className="admin-topbar-right">
          <span className="admin-badge">
            {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            className="admin-btn-add-secondary"
            onClick={() => load()}
            title="Refresh data"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginRight: 4 }}>
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2M13.5 2v3.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
          <button
            type="button"
            className="admin-btn-add-secondary"
            onClick={() => setLocation("/admin/quote-library")}
          >
            Quote Library →
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="admin-content">

        {/* Hero row: KPI stack (left) + Geo Map (right) */}
        <div className="db-hero-row">

          {/* Left: 6 KPI cards stacked */}
          <div className="db-kpi-stack">
            {kpiCards.map((card) => (
              <div key={card.label} className="db-kpi-card">
                <div className="db-kpi-header">
                  <span className="db-kpi-label">{card.label}</span>
                  <span style={{ color: card.color, opacity: 0.75 }}>{card.icon}</span>
                </div>
                <div className="db-kpi-value">{card.value}</div>
                <div className="db-kpi-sub">{card.sub}</div>
              </div>
            ))}

            {/* Customer Requested Amount */}
            <div className="db-kpi-card">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Customer Requested Amount</span>
                <span style={{ color: "#14b8a6", opacity: 0.75 }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3v14M7 6h4.5a2.5 2.5 0 0 1 0 5H7m0 0h5.5a2.5 2.5 0 0 1 0 5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
              <div className="db-kpi-value">{fmt(totalReqMonthly)}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)" }}>/mo</span></div>
              <div className="db-kpi-sub">{fmt(totalReqMonthly * 12)} ARR</div>
              <div className="db-kpi-breakdown">
                <span className="db-kpi-pass">Pass {fmt(kpis.passRequestedMonthly)}</span>
                <span className="db-kpi-fail">Fail {fmt(kpis.failRequestedMonthly)}</span>
              </div>
            </div>

            {/* Requested Upfront Amount */}
            <div className="db-kpi-card">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Requested Upfront Amount</span>
                <span style={{ color: "#8b5cf6", opacity: 0.75 }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M3 10h14M10 3l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
              <div className="db-kpi-value">{fmt(totalReqUpfront)}</div>
              <div className="db-kpi-sub">total one-time requested</div>
              <div className="db-kpi-breakdown">
                <span className="db-kpi-pass">Pass {fmt(kpis.passRequestedUpfront)}</span>
                <span className="db-kpi-fail">Fail {fmt(kpis.failRequestedUpfront)}</span>
              </div>
            </div>

            {/* Payments Processing Revenue */}
            {(kpis.totalPaymentsRevMo > 0) && (
              <div className="db-kpi-card">
                <div className="db-kpi-header">
                  <span className="db-kpi-label">Payments Processing Rev</span>
                  <span style={{ color: "#16a34a", opacity: 0.75 }}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </div>
                <div className="db-kpi-value" style={{ color: "#16a34a" }}>
                  {fmt(kpis.passPaymentsRevMo)}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)" }}>/mo</span>
                </div>
                <div className="db-kpi-sub">
                  {kpis.passTotalSites > 0 ? `${fmt(kpis.passPaymentsRevMo / kpis.passTotalSites)}/site · ` : ""}
                  {kpis.passTotalSites} won site{kpis.passTotalSites !== 1 ? "s" : ""}
                </div>
                <div className="db-kpi-breakdown">
                  <span className="db-kpi-pass">Won {fmt(kpis.passPaymentsRevMo)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>Pipeline {fmt(kpis.totalPaymentsRevMo)}</span>
                </div>
              </div>
            )}

            {/* Gateway Revenue */}
            {(kpis.totalGatewayRevMo > 0) && (
              <div className="db-kpi-card">
                <div className="db-kpi-header">
                  <span className="db-kpi-label">Gateway Revenue</span>
                  <span style={{ color: "#0369a1", opacity: 0.75 }}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                <div className="db-kpi-value" style={{ color: "#0369a1" }}>
                  {fmt(kpis.passGatewayRevMo)}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)" }}>/mo</span>
                </div>
                <div className="db-kpi-sub">
                  {kpis.passTotalSites > 0 ? `${fmt(kpis.passGatewayRevMo / kpis.passTotalSites)}/site · ` : ""}
                  {kpis.passTotalSites} won site{kpis.passTotalSites !== 1 ? "s" : ""}
                </div>
                <div className="db-kpi-breakdown">
                  <span className="db-kpi-pass">Won {fmt(kpis.passGatewayRevMo)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>Pipeline {fmt(kpis.totalGatewayRevMo)}</span>
                </div>
              </div>
            )}

            {/* Amendments */}
            <div className="db-kpi-card">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Amendments</span>
                <span style={{ color: "#7c3aed", opacity: 0.75 }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M4 4h8l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M12 4v4h4M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
              <div className="db-kpi-value">{amendments?.total ?? 0}</div>
              <div className="db-kpi-sub">total amendments filed</div>
              <div className="db-kpi-breakdown">
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>This month: <strong style={{ color: "var(--text)" }}>{amendments?.thisMonth ?? 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Per-location cards */}
          <LocationCardsPanel
            byState={geoDistribution?.byState ?? []}
            byCountry={geoDistribution?.byCountry ?? []}
          />
        </div>

        {/* Row 2: Recent Quotes table + sidebar */}
        <div className="db-main-row">

          {/* Recent Quotes Table */}
          <div className="db-card" style={{ flex: 1, minWidth: 0 }}>
            <div className="db-card-header">
              <span className="db-card-title">Recent Quotes</span>
              <button type="button" className="db-text-btn" onClick={() => setLocation("/admin/quote-library")}>
                View all →
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="db-table">
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
                      <td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: "20px 0" }}>
                        No quotes yet
                      </td>
                    </tr>
                  ) : (
                    recentQuotes.map((q) => {
                      const st = q.passStatus?.toLowerCase();
                      const location =
                        [q.addressCity, q.addressState].filter(Boolean).join(", ") ||
                        [q.addressState, q.addressCountry].filter(Boolean).join(", ") ||
                        q.addressLine?.split(",").slice(-3).join(",").trim() ||
                        "—";
                      return (
                        <tr key={q.id}>
                          <td style={{ fontWeight: 600, color: "var(--accent)" }}>{q.quoteNumber}</td>
                          <td style={{ fontWeight: 500 }}>{q.companyName}</td>
                          <td style={{ color: "var(--text-2)" }}>{location}</td>
                          <td style={{ color: "var(--text-2)" }}>{q.salesRep}</td>
                          <td style={{ fontWeight: 700 }}>{fmt(q.value)}</td>
                          <td>
                            {st === "pass" && <span className="lib-badge lib-badge-pass">PASS</span>}
                            {st === "fail" && <span className="lib-badge lib-badge-fail">FAIL</span>}
                            {!st && <span className="lib-badge lib-badge-none">—</span>}
                          </td>
                          <td style={{ color: "var(--text-3)" }}>{timeAgo(q.updatedAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar column */}
          <div className="db-sidebar-col">

            {/* Sales Reps */}
            <div className="db-card">
              <div className="db-card-header">
                <span className="db-card-title">Quotes by Sales Rep</span>
              </div>
              {topReps.length === 0 ? (
                <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>No data yet</p>
              ) : (
                topReps.map((r, i) => {
                  const color = REP_COLORS[i % REP_COLORS.length];
                  const initials = r.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  const maxVal = topReps[0]?.value || 1;
                  return (
                    <div key={r.name} className="db-rep-row">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="db-rep-avatar" style={{ background: color + "20", color }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                              {r.quotes} quote{r.quotes !== 1 ? "s" : ""} · {r.pass} passed
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{fmt(r.value)}</span>
                      </div>
                      <div className="db-progress-bg">
                        <div className="db-progress-fill" style={{ width: `${(r.value / maxVal) * 100}%`, background: color }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* PIT Distribution */}
            <div className="db-card">
              <div className="db-card-header">
                <span className="db-card-title">PIT Type Distribution</span>
              </div>
              <div className="db-pit-bar">
                {pitDistribution.map((p) => (
                  <div key={p.label} style={{ flex: p.count / pitTotal, background: PIT_COLORS[p.label] ?? "#94a3b8" }} />
                ))}
              </div>
              {pitDistribution.map((p) => (
                <div key={p.label} className="db-pit-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div className="db-pit-dot" style={{ background: PIT_COLORS[p.label] ?? "#94a3b8" }} />
                    <span style={{ fontSize: 12, color: "var(--text-2)" }}>{p.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{p.count}</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{Math.round((p.count / pitTotal) * 100)}%</span>
                  </div>
                </div>
              ))}
              {pitDistribution.length === 0 && (
                <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>No data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Monthly Pipeline + Top Customers + Recent Activity */}
        <div className="db-bottom-row">

          {/* Monthly Pipeline bar chart */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Monthly Pipeline</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>ARR value of quotes created per month</div>
            <div className="db-bar-chart">
              {monthlyData.map((d, i) => (
                <div key={d.month} className="db-bar-col">
                  <div
                    className="db-bar"
                    style={{
                      height: `${(d.value / maxBar) * 88}px`,
                      background: i === monthlyData.length - 1 ? "var(--accent)" : "var(--accent-subtle, #ede9fe)",
                    }}
                  />
                  <span className="db-bar-label">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Customers */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Top Customers by Value</span>
            </div>
            {topCustomers.length === 0 ? (
              <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>No data yet</p>
            ) : (
              topCustomers.map((c, i) => (
                <div key={c.name} className="db-customer-row">
                  <div
                    className="db-customer-rank"
                    style={{
                      background: i === 0 ? "var(--accent-subtle, #ede9fe)" : "var(--bg)",
                      color: i === 0 ? "var(--accent)" : "var(--text-2)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {c.sites} quote{c.sites !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "var(--accent)" : "var(--text)", flexShrink: 0 }}>
                    {fmt(c.value)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Recent Activity */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Recent Activity</span>
            </div>
            {recentActivity.length === 0 ? (
              <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>No activity yet</p>
            ) : (
              recentActivity.map((a, i) => (
                <div key={i} className="db-activity-row">
                  <div className="db-activity-dot" style={{ background: a.dot }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{a.action}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
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
