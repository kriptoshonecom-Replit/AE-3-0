import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import GlobalNavTrigger from "@/components/GlobalNavTrigger";
import { RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface LoginEvent {
  id: string;
  email: string;
  userId: string | null;
  fullName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  createdAt: string;
}

interface ActiveSession {
  id: string;
  email: string | null;
  fullName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

function parseUA(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Chrome / Windows";
    if (/Firefox/i.test(ua)) return "Firefox / Windows";
    if (/Edge/i.test(ua)) return "Edge / Windows";
    return "Windows";
  }
  if (/Macintosh|Mac OS/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Chrome / Mac";
    if (/Firefox/i.test(ua)) return "Firefox / Mac";
    if (/Safari/i.test(ua)) return "Safari / Mac";
    return "Mac";
  }
  if (/Linux/i.test(ua)) return "Linux";
  return ua.slice(0, 40);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function LogJournalPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"events" | "sessions">("events");
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSuccess, setFilterSuccess] = useState<"all" | "success" | "failed">("all");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, seRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/log-journal?limit=200`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/log-journal/sessions`, { credentials: "include" }),
      ]);
      const evData = await evRes.json() as { events: LoginEvent[] };
      const seData = await seRes.json() as { sessions: ActiveSession[] };
      setEvents(Array.isArray(evData.events) ? evData.events : []);
      setSessions(Array.isArray(seData.sessions) ? seData.sessions : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const filteredEvents = events.filter((e) => {
    if (filterSuccess === "success" && !e.success) return false;
    if (filterSuccess === "failed" && e.success) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        e.email.toLowerCase().includes(q) ||
        (e.fullName ?? "").toLowerCase().includes(q) ||
        (e.ipAddress ?? "").includes(q)
      );
    }
    return true;
  });

  const filteredSessions = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.fullName ?? "").toLowerCase().includes(q) ||
      (s.ipAddress ?? "").includes(q)
    );
  });

  const successCount = events.filter((e) => e.success).length;
  const failCount = events.filter((e) => !e.success).length;

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <GlobalNavTrigger />
        <h1 className="admin-page-title">Log Journals</h1>
        <div className="admin-topbar-right">
          <button className="btn-ghost" onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, padding: "24px 24px 16px", flexWrap: "wrap" }}>
        {[
          { label: "Total Events", value: events.length, color: "var(--text)" },
          { label: "Successful Logins", value: successCount, color: "var(--success, #16a34a)" },
          { label: "Failed Attempts", value: failCount, color: "var(--danger, #e55)" },
          { label: "Active Sessions", value: sessions.length, color: "var(--accent, #6c47ff)" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--card-bg, #fff)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 18px",
            minWidth: 130,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 24px 12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", fontSize: 12, fontWeight: 600 }}>
          {(["events", "sessions"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{
              padding: "5px 14px", border: "none", cursor: "pointer",
              background: tab === t ? "var(--accent, #6c47ff)" : "transparent",
              color: tab === t ? "#fff" : "var(--text-muted)",
              transition: "background 0.15s, color 0.15s",
            }}>
              {t === "events" ? "Login Events" : "Active Sessions"}
            </button>
          ))}
        </div>

        {tab === "events" && (
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", fontSize: 12, fontWeight: 600 }}>
            {(["all", "success", "failed"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilterSuccess(f)} style={{
                padding: "5px 12px", border: "none", cursor: "pointer",
                background: filterSuccess === f ? "var(--muted-bg, #f1f5f9)" : "transparent",
                color: filterSuccess === f ? "var(--text)" : "var(--text-muted)",
                transition: "background 0.15s",
              }}>
                {f === "all" ? "All" : f === "success" ? "Successful" : "Failed"}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or IP…"
          style={{
            padding: "5px 11px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg)", color: "var(--text)", fontSize: 12,
            width: 220, outline: "none",
          }}
        />
      </div>

      <div className="admin-table-wrap">
        {loading ? (
          <div className="admin-table-empty" style={{ padding: 40 }}>
            <span className="btn-spinner" style={{ width: 20, height: 20 }} />
          </div>
        ) : tab === "events" ? (
          filteredEvents.length === 0 ? (
            <div className="admin-table-empty" style={{ padding: 32 }}>No login events found.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Result</th>
                  <th>IP Address</th>
                  <th>Device / Browser</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <div className="admin-td-bold">{ev.fullName ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ev.email}</div>
                    </td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 11, fontWeight: 600, padding: "3px 10px",
                        borderRadius: 20,
                        background: ev.success ? "var(--success-bg, #dcfce7)" : "var(--danger-bg, #fee2e2)",
                        color: ev.success ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%", display: "inline-block",
                          background: ev.success ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
                        }} />
                        {ev.success ? "Success" : "Failed"}
                      </span>
                      {ev.failureReason && (
                        <div style={{ fontSize: 10, color: "var(--danger, #dc2626)", marginTop: 3 }}>
                          {ev.failureReason}
                        </div>
                      )}
                    </td>
                    <td>
                      <code className="admin-code">{ev.ipAddress ?? "—"}</code>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {parseUA(ev.userAgent)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 12 }}>{fmtDate(ev.createdAt)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(ev.createdAt)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          filteredSessions.length === 0 ? (
            <div className="admin-table-empty" style={{ padding: 32 }}>No active sessions found.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Device / Browser</th>
                  <th>Logged In</th>
                  <th>Last Active</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="admin-td-bold">{s.fullName ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.email ?? "—"}</div>
                    </td>
                    <td>
                      <code className="admin-code">{s.ipAddress ?? "—"}</code>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {parseUA(s.userAgent)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 12 }}>{fmtDate(s.createdAt)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(s.createdAt)}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 12 }}>{timeAgo(s.lastActiveAt)}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--text-muted)" }}>
                      {fmtDate(s.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
