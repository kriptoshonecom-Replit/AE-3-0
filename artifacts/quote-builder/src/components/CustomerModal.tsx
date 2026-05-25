import { useState } from "react";
import type { CustomerProfile } from "../pages/CDMPage";
import type { Quote } from "../types";
import { quoteTotal, formatCurrency } from "../utils/calculations";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const C = 226.19;

type Tab = "contact" | "quotes" | "dashboard" | "email";

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAddr(addr: { name?: string; number?: string; city?: string; state?: string; zip?: string; country?: string } | null) {
  if (!addr) return null;
  const parts = [
    addr.name,
    addr.number,
    addr.city && addr.state ? `${addr.city}, ${addr.state}` : (addr.city || addr.state),
    addr.zip,
    addr.country,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function getHealth(pass: number, fail: number) {
  const total = pass + fail;
  if (total === 0) return { label: "No Data", color: "#94a3b8" };
  const r = pass / total;
  if (r >= 0.8) return { label: "Excellent", color: "#10b981" };
  if (r >= 0.5) return { label: "Good", color: "#84cc16" };
  if (r >= 0.2) return { label: "Fair", color: "#f59e0b" };
  return { label: "Poor", color: "#ef4444" };
}

function DonutChart({ pass, fail, noStatus }: { pass: number; fail: number; noStatus: number }) {
  const total = pass + fail + noStatus;
  if (total === 0) {
    return (
      <div className="cdm-donut-empty">
        <svg viewBox="0 0 100 100" width={140} height={140}>
          <circle cx="50" cy="50" r="36" fill="none" stroke="var(--surface-2, #f0f4f8)" strokeWidth="12" />
          <text x="50" y="46" textAnchor="middle" fontSize="11" fill="var(--text-3, #94a3b8)">No</text>
          <text x="50" y="60" textAnchor="middle" fontSize="11" fill="var(--text-3, #94a3b8)">Quotes</text>
        </svg>
      </div>
    );
  }

  const passArc = (pass / total) * C;
  const failArc = (fail / total) * C;
  const noStatusArc = (noStatus / total) * C;

  return (
    <svg viewBox="0 0 100 100" width={140} height={140}>
      <circle cx="50" cy="50" r="36" fill="none" stroke="var(--surface-2, #f0f4f8)" strokeWidth="12" />
      {noStatusArc > 0.5 && (
        <circle
          cx="50" cy="50" r="36" fill="none"
          stroke="#cbd5e1" strokeWidth="12"
          strokeDasharray={`${noStatusArc} ${C}`}
          strokeDashoffset={-(passArc + failArc)}
          transform="rotate(-90 50 50)"
          strokeLinecap="butt"
        />
      )}
      {failArc > 0.5 && (
        <circle
          cx="50" cy="50" r="36" fill="none"
          stroke="#f87171" strokeWidth="12"
          strokeDasharray={`${failArc} ${C}`}
          strokeDashoffset={-passArc}
          transform="rotate(-90 50 50)"
          strokeLinecap="butt"
        />
      )}
      {passArc > 0.5 && (
        <circle
          cx="50" cy="50" r="36" fill="none"
          stroke="#34d399" strokeWidth="12"
          strokeDasharray={`${passArc} ${C}`}
          strokeDashoffset={0}
          transform="rotate(-90 50 50)"
          strokeLinecap="butt"
        />
      )}
      <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text, #1e293b)">{total}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="8" fill="var(--text-3, #94a3b8)">QUOTES</text>
    </svg>
  );
}

interface Props {
  customer: CustomerProfile;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (updated: CustomerProfile) => void;
}

export default function CustomerModal({ customer, isAdmin, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>("contact");

  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    companyName: customer.companyName,
    customerName: customer.customerName,
    customerEmail: customer.customerEmail,
    customerPhone: customer.customerPhone,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [mailTo, setMailTo] = useState(customer.customerEmail);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailRef, setMailRef] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"sent" | "error" | null>(null);

  const health = getHealth(customer.passCount, customer.failCount);
  const noStatus = customer.quotes.filter(q => !q.passStatus).length;

  const totalMRR = customer.quotes.reduce((sum, q) => {
    if (!q.data) return sum;
    try { return sum + quoteTotal(q.data as Quote); } catch { return sum; }
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${encodeURIComponent(customer.key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(editFields),
        }
      );
      if (!res.ok) throw new Error("Save failed");
      onSaved({ ...customer, ...editFields });
      setEditing(false);
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendMail = async () => {
    if (!mailTo || !mailSubject || !mailBody) return;
    setSending(true);
    setSendResult(null);
    try {
      let body = mailBody;
      if (mailRef) {
        const refQ = customer.quotes.find(q => q.id === mailRef);
        if (refQ) body += `\n\nReferenced Quote: ${refQ.quoteNumber || "Untitled"}`;
      }
      const res = await fetch(`${API_BASE}/api/customers/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: mailTo, subject: mailSubject, body }),
      });
      if (!res.ok) throw new Error("Send failed");
      setSendResult("sent");
      setMailSubject("");
      setMailBody("");
      setMailRef("");
    } catch {
      setSendResult("error");
    } finally {
      setSending(false);
    }
  };

  const tabLabels: Record<Tab, string> = {
    contact: "Contact",
    quotes: `Quotes (${customer.quotes.length})`,
    dashboard: "Dashboard",
    email: "Send Email",
  };

  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cdm-modal" onMouseDown={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="cdm-modal-header">
          <div className="cdm-modal-header-left">
            <div className="cdm-avatar">
              {(customer.companyName?.[0] || customer.customerName?.[0] || "?").toUpperCase()}
            </div>
            <div className="cdm-header-names">
              <h2 className="cdm-modal-title">
                {customer.companyName || customer.customerName || "Unknown Customer"}
              </h2>
              {customer.companyName && customer.customerName && (
                <p className="cdm-modal-sub">{customer.customerName}</p>
              )}
            </div>
            <span
              className="cdm-health-badge"
              style={{
                background: health.color + "22",
                color: health.color,
                border: `1px solid ${health.color}44`,
              }}
            >
              {health.label}
            </span>
          </div>
          <button className="cdm-close-btn" onClick={onClose} type="button" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="cdm-tabs">
          {(["contact", "quotes", "dashboard", "email"] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              className={`cdm-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="cdm-modal-body">

          {/* CONTACT */}
          {tab === "contact" && (
            <div className="cdm-section">
              {editing && isAdmin ? (
                <div className="cdm-edit-form">
                  <div className="cdm-form-row">
                    <div className="cdm-form-field">
                      <label>Company Name</label>
                      <input
                        type="text"
                        value={editFields.companyName}
                        onChange={e => setEditFields(f => ({ ...f, companyName: e.target.value }))}
                      />
                    </div>
                    <div className="cdm-form-field">
                      <label>Customer Name</label>
                      <input
                        type="text"
                        value={editFields.customerName}
                        onChange={e => setEditFields(f => ({ ...f, customerName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="cdm-form-row">
                    <div className="cdm-form-field">
                      <label>Email</label>
                      <input
                        type="email"
                        value={editFields.customerEmail}
                        onChange={e => setEditFields(f => ({ ...f, customerEmail: e.target.value }))}
                      />
                    </div>
                    <div className="cdm-form-field">
                      <label>Phone</label>
                      <input
                        type="tel"
                        value={editFields.customerPhone}
                        onChange={e => setEditFields(f => ({ ...f, customerPhone: e.target.value }))}
                      />
                    </div>
                  </div>
                  {saveError && (
                    <div className="lib-drawer-error">{saveError}</div>
                  )}
                  <div className="cdm-form-actions">
                    <button
                      className="admin-btn-add-secondary"
                      type="button"
                      onClick={() => { setEditing(false); setSaveError(""); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="admin-btn-edit"
                      style={{ padding: "6px 18px" }}
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="cdm-contact-grid">
                    <div className="cdm-contact-item">
                      <span className="cdm-contact-label">Company</span>
                      <span className="cdm-contact-value">{customer.companyName || "—"}</span>
                    </div>
                    <div className="cdm-contact-item">
                      <span className="cdm-contact-label">Contact</span>
                      <span className="cdm-contact-value">{customer.customerName || "—"}</span>
                    </div>
                    <div className="cdm-contact-item">
                      <span className="cdm-contact-label">Email</span>
                      <span className="cdm-contact-value">
                        {customer.customerEmail
                          ? <a href={`mailto:${customer.customerEmail}`} style={{ color: "var(--accent)" }}>{customer.customerEmail}</a>
                          : "—"}
                      </span>
                    </div>
                    <div className="cdm-contact-item">
                      <span className="cdm-contact-label">Phone</span>
                      <span className="cdm-contact-value">{customer.customerPhone || "—"}</span>
                    </div>
                  </div>

                  {(customer.address || customer.billingAddress) && (
                    <div className="cdm-address-section">
                      {customer.address && (
                        <div className="cdm-address-block">
                          <div className="cdm-address-label">Service Address</div>
                          <div className="cdm-address-value">{fmtAddr(customer.address) || "—"}</div>
                        </div>
                      )}
                      {customer.billingAddress && (
                        <div className="cdm-address-block">
                          <div className="cdm-address-label">Billing Address</div>
                          <div className="cdm-address-value">{fmtAddr(customer.billingAddress) || "—"}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {(customer.creatorName || customer.creatorEmail) && (
                    <div className="cdm-contact-grid" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                      {customer.creatorName && (
                        <div className="cdm-contact-item">
                          <span className="cdm-contact-label">Account Rep</span>
                          <span className="cdm-contact-value">{customer.creatorName}</span>
                        </div>
                      )}
                      {customer.creatorEmail && (
                        <div className="cdm-contact-item">
                          <span className="cdm-contact-label">Rep Email</span>
                          <span className="cdm-contact-value" style={{ fontSize: 12 }}>
                            <a href={`mailto:${customer.creatorEmail}`} style={{ color: "var(--accent)" }}>
                              {customer.creatorEmail}
                            </a>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {isAdmin && (
                    <div style={{ marginTop: 24 }}>
                      <button
                        className="admin-btn-edit"
                        style={{ padding: "6px 16px" }}
                        type="button"
                        onClick={() => setEditing(true)}
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                          <path d="M9.5 1.5a2.121 2.121 0 0 1 3 3L4 13H1v-3L9.5 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Edit Contact Info
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* QUOTES */}
          {tab === "quotes" && (
            <div className="cdm-section">
              {customer.quotes.length === 0 ? (
                <div className="admin-table-empty">No quotes found for this customer.</div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Quote #</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Total MRR</th>
                        <th>Created</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.quotes
                        .slice()
                        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                        .map(q => (
                          <tr key={q.id}>
                            <td className="admin-td-bold" style={{ fontFamily: "monospace", fontSize: 12 }}>
                              {q.quoteNumber || <span style={{ color: "var(--text-3)" }}>Untitled</span>}
                            </td>
                            <td>
                              {q.passStatus === "pass" && <span className="lib-badge lib-badge-pass">PASS</span>}
                              {q.passStatus === "fail" && <span className="lib-badge lib-badge-fail">FAIL</span>}
                              {!q.passStatus && <span className="lib-badge lib-badge-none">—</span>}
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                              {q.data ? formatCurrency(quoteTotal(q.data as Quote)) : "—"}
                            </td>
                            <td style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                              {fmtDate(q.createdAt)}
                            </td>
                            <td style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                              {fmtDate(q.updatedAt)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div className="cdm-section">
              <div className="cdm-dashboard">
                <div className="cdm-donut-wrap">
                  <DonutChart pass={customer.passCount} fail={customer.failCount} noStatus={noStatus} />
                  <div className="cdm-donut-legend">
                    <div className="cdm-legend-item">
                      <span className="cdm-legend-dot" style={{ background: "#34d399" }} />
                      <span>Pass ({customer.passCount})</span>
                    </div>
                    <div className="cdm-legend-item">
                      <span className="cdm-legend-dot" style={{ background: "#f87171" }} />
                      <span>Fail ({customer.failCount})</span>
                    </div>
                    {noStatus > 0 && (
                      <div className="cdm-legend-item">
                        <span className="cdm-legend-dot" style={{ background: "#cbd5e1" }} />
                        <span>No Status ({noStatus})</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cdm-stat-grid">
                  <div className="cdm-stat-card">
                    <span className="cdm-stat-label">Total Quotes</span>
                    <span className="cdm-stat-value">{customer.quotes.length}</span>
                  </div>
                  <div className="cdm-stat-card">
                    <span className="cdm-stat-label">Total MRR</span>
                    <span className="cdm-stat-value" style={{ fontSize: 18 }}>{formatCurrency(totalMRR)}</span>
                  </div>
                  <div className="cdm-stat-card">
                    <span className="cdm-stat-label">Win Rate</span>
                    <span className="cdm-stat-value" style={{ color: health.color }}>
                      {(customer.passCount + customer.failCount) > 0
                        ? `${Math.round((customer.passCount / (customer.passCount + customer.failCount)) * 100)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="cdm-stat-card">
                    <span className="cdm-stat-label">Account Health</span>
                    <span className="cdm-stat-value" style={{ color: health.color, fontSize: 16 }}>
                      {health.label}
                    </span>
                  </div>
                  <div className="cdm-stat-card">
                    <span className="cdm-stat-label">Last Activity</span>
                    <span className="cdm-stat-value" style={{ fontSize: 14 }}>
                      {fmtDate(customer.lastActivity)}
                    </span>
                  </div>
                  <div className="cdm-stat-card">
                    <span className="cdm-stat-label">Avg MRR / Quote</span>
                    <span className="cdm-stat-value" style={{ fontSize: 16 }}>
                      {customer.quotes.length > 0 ? formatCurrency(totalMRR / customer.quotes.length) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMAIL */}
          {tab === "email" && (
            <div className="cdm-section">
              <div className="cdm-mail-form">
                <div className="cdm-form-field">
                  <label>To</label>
                  <input
                    type="email"
                    value={mailTo}
                    onChange={e => setMailTo(e.target.value)}
                    placeholder="recipient@example.com"
                  />
                </div>
                <div className="cdm-form-field">
                  <label>Subject</label>
                  <input
                    type="text"
                    value={mailSubject}
                    onChange={e => setMailSubject(e.target.value)}
                    placeholder="Subject…"
                  />
                </div>
                {customer.quotes.length > 0 && (
                  <div className="cdm-form-field">
                    <label>Attach Quote Reference</label>
                    <select
                      value={mailRef}
                      onChange={e => setMailRef(e.target.value)}
                      className="cdm-select"
                    >
                      <option value="">None</option>
                      {customer.quotes.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.quoteNumber || "Untitled"} — {q.passStatus ? q.passStatus.toUpperCase() : "No Status"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="cdm-form-field">
                  <label>Message</label>
                  <textarea
                    className="cdm-mail-body"
                    value={mailBody}
                    onChange={e => setMailBody(e.target.value)}
                    placeholder="Write your message here…"
                    rows={8}
                  />
                </div>
                {sendResult === "sent" && (
                  <div className="cdm-send-result cdm-send-ok">
                    Email sent successfully.
                  </div>
                )}
                {sendResult === "error" && (
                  <div className="cdm-send-result cdm-send-err">
                    Failed to send email. Please try again.
                  </div>
                )}
                <div className="cdm-form-actions">
                  <button
                    className="admin-btn-add-secondary"
                    type="button"
                    onClick={() => { setMailSubject(""); setMailBody(""); setMailRef(""); setSendResult(null); }}
                  >
                    Clear
                  </button>
                  <button
                    className="admin-btn-edit"
                    style={{ padding: "7px 20px" }}
                    type="button"
                    onClick={() => void handleSendMail()}
                    disabled={sending || !mailTo || !mailSubject || !mailBody}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
                      <path d="M2 2l12 6-12 6V9.5L11 8 2 6.5V2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {sending ? "Sending…" : "Send Email"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
