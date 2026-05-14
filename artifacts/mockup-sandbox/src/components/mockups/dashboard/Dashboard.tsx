export function Dashboard() {
  const stats = [
    { label: "Total Pipeline Value", value: "$284,750", sub: "across 18 active quotes", color: "#7c3aed", icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 7v11h5v-5h4v5h5V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
    )},
    { label: "Quotes This Month", value: "18", sub: "+4 from last month", color: "#0ea5e9", icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
    { label: "Pass Rate", value: "72%", sub: "13 of 18 quotes passed", color: "#22c55e", icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    )},
    { label: "Avg Quote Value", value: "$15,819", sub: "per quote (MRR)", color: "#f97316", icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M7 6h4.5a2.5 2.5 0 0 1 0 5H7m0 0h5.5a2.5 2.5 0 0 1 0 5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
  ];

  const quotes = [
    { id: "Q-2024-041", company: "The Rustic Grill", rep: "Jane Smith", value: "$24,200", status: "pass", updated: "May 13", address: "Orlando, FL" },
    { id: "Q-2024-040", company: "Harbor Lights Bar", rep: "Mark Davis", value: "$18,450", status: "pass", updated: "May 12", address: "Miami, FL" },
    { id: "Q-2024-039", company: "Metro Café Group", rep: "Jane Smith", value: "$32,100", status: "fail", updated: "May 11", address: "Atlanta, GA" },
    { id: "Q-2024-038", company: "Sunset Bistro", rep: "Lisa Chen", value: "$9,800", status: "pass", updated: "May 10", address: "Tampa, FL" },
    { id: "Q-2024-037", company: "The Anchor Bar", rep: "Mark Davis", value: "$14,350", status: "pass", updated: "May 9", address: "Nashville, TN" },
    { id: "Q-2024-036", company: "Urban Kitchen Co", rep: "Lisa Chen", value: "$27,600", status: null, updated: "May 8", address: "Charlotte, NC" },
    { id: "Q-2024-035", company: "Patio Grill & Bar", rep: "Jane Smith", value: "$11,200", status: "fail", updated: "May 7", address: "Austin, TX" },
  ];

  const reps = [
    { name: "Jane Smith",  quotes: 7, value: "$98,200",  pass: 5, color: "#7c3aed" },
    { name: "Mark Davis",  quotes: 6, value: "$76,400",  pass: 4, color: "#0ea5e9" },
    { name: "Lisa Chen",   quotes: 5, value: "$67,150",  pass: 5, color: "#22c55e" },
    { name: "Tom Reyes",   quotes: 0, value: "$43,000",  pass: 3, color: "#f97316" },
  ];

  const monthlyData = [
    { month: "Dec", value: 110 }, { month: "Jan", value: 145 }, { month: "Feb", value: 128 },
    { month: "Mar", value: 162 }, { month: "Apr", value: 195 }, { month: "May", value: 178 },
  ];
  const maxBar = Math.max(...monthlyData.map(d => d.value));

  const pitTypes = [
    { label: "Standard", count: 8, color: "#7c3aed" },
    { label: "Premium",  count: 5, color: "#0ea5e9" },
    { label: "None",     count: 5, color: "#e2e8f0" },
  ];
  const totalPit = pitTypes.reduce((s, p) => s + p.count, 0);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f1f5f9", minHeight: "100vh", padding: "24px 28px", color: "#0f172a" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "#7c3aed", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 7v11h5v-5h4v5h5V7L10 2z" fill="white"/></svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Aloha Essential CPQ</span>
            <span style={{ fontSize: 12, background: "#ede9fe", color: "#7c3aed", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>Dashboard</span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Quote performance overview · May 2024</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", fontSize: 13, color: "#475569", cursor: "pointer" }}>Last 30 days ▾</div>
          <div style={{ background: "#7c3aed", borderRadius: 8, padding: "7px 16px", fontSize: 13, color: "white", fontWeight: 600, cursor: "pointer" }}>+ New Quote</div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "white", borderRadius: 12, padding: "18px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
              <div style={{ color: s.color, opacity: 0.7 }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 2: Quotes table + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 16 }}>

        {/* Recent Quotes Table */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Recent Quotes</span>
            <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600, cursor: "pointer" }}>View all →</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Quote #", "Company", "Address", "Sales Rep", "MRR Value", "Status", "Updated"].map(h => (
                  <th key={h} style={{ padding: "9px 16px", fontSize: 11, fontWeight: 600, color: "#94a3b8", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => (
                <tr key={q.id} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafafa", cursor: "pointer" }}>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#7c3aed" }}>{q.id}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 500 }}>{q.company}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>{q.address}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>{q.rep}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>{q.value}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {q.status === "pass" && <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>PASS</span>}
                    {q.status === "fail" && <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>FAIL</span>}
                    {!q.status && <span style={{ background: "#f1f5f9", color: "#94a3b8", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>PENDING</span>}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>{q.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sidebar: Reps + PIT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Sales Reps */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Quotes by Sales Rep</div>
            {reps.map((r) => (
              <div key={r.name} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: r.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: r.color }}>
                      {r.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.quotes} quotes · {r.pass} passed</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{r.value}</span>
                </div>
                <div style={{ height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${r.pass / 5 * 100}%`, background: r.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>

          {/* PIT Distribution */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>PIT Type Distribution</div>
            <div style={{ display: "flex", gap: 4, height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
              {pitTypes.map(p => (
                <div key={p.label} style={{ flex: p.count / totalPit, background: p.color }} />
              ))}
            </div>
            {pitTypes.map(p => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
                  <span style={{ fontSize: 12, color: "#475569" }}>{p.label}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{p.count}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{Math.round(p.count / totalPit * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Pipeline bar chart + Top customers + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

        {/* Monthly Pipeline */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "16px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Monthly Pipeline</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>MRR value of new quotes (thousands)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
            {monthlyData.map((d, i) => (
              <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: "100%", borderRadius: "4px 4px 0 0",
                  height: `${(d.value / maxBar) * 88}px`,
                  background: i === monthlyData.length - 1 ? "#7c3aed" : "#e0d4fb",
                  transition: "height 0.3s"
                }} />
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "16px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Top Customers by Value</div>
          {[
            { name: "Metro Café Group", value: "$32,100", sites: "6 sites", icon: "🍽️" },
            { name: "Urban Kitchen Co", value: "$27,600", sites: "5 sites", icon: "🏙️" },
            { name: "The Rustic Grill",  value: "$24,200", sites: "4 sites", icon: "🔥" },
            { name: "Harbor Lights Bar", value: "$18,450", sites: "3 sites", icon: "⚓" },
            { name: "Patio Grill & Bar", value: "$11,200", sites: "2 sites", icon: "🌿" },
          ].map((c, i) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.sites}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#7c3aed" : "#0f172a" }}>{c.value}</span>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "16px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Recent Activity</div>
          {[
            { action: "Q-2024-041 marked PASS", rep: "Jane Smith", time: "2h ago", dot: "#22c55e" },
            { action: "Q-2024-039 marked FAIL", rep: "Mark Davis", time: "5h ago", dot: "#ef4444" },
            { action: "Q-2024-042 created",      rep: "Lisa Chen",  time: "Yesterday", dot: "#7c3aed" },
            { action: "Q-2024-038 PDF exported", rep: "Jane Smith", time: "Yesterday", dot: "#0ea5e9" },
            { action: "Q-2024-040 admin edited", rep: "Admin",      time: "May 11",    dot: "#f97316" },
            { action: "Q-2024-036 created",      rep: "Lisa Chen",  time: "May 10",    dot: "#7c3aed" },
          ].map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ marginTop: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.dot }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{a.action}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{a.rep} · {a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
