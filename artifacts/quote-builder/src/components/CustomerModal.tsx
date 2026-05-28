import { useState, useEffect } from "react";
import type { CustomerProfile } from "../pages/CDMPage";
import type { Quote } from "../types";
import { quoteTotal, formatCurrency } from "../utils/calculations";
import { formatPhoneUS } from "../utils/phone";
import { RichTextEditor } from "./RichTextEditor";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const C = 226.19;

type Tab = "contact" | "quotes" | "amendments" | "dashboard" | "email";

interface AmendmentRow {
  id: string;
  originalQuoteId: string;
  originalQuoteNumber: string | null;
  quoteNumber: string | null;
  amendmentNumber: number;
  companyName: string | null;
  customerName: string | null;
  data: { mrrDelta?: number; subtotalDelta?: number; notes?: string };
  createdAt: string;
  updatedAt: string;
  pdfSavedAt?: string | null;
}

function fmtAmendNum(n: number) {
  return `Amend ${String(n).padStart(3, "0")}`;
}

function MrrDeltaBadge({ value }: { value: number | undefined }) {
  if (!value) return <span style={{ color: "var(--text-3)" }}>—</span>;
  const color = value > 0 ? "#10b981" : "#ef4444";
  return (
    <span style={{ color, fontWeight: 600 }}>
      {value > 0 ? "+" : ""}{formatCurrency(value)}
    </span>
  );
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAddr(addr: { line?: string; name?: string; number?: string; city?: string; state?: string; zip?: string; country?: string } | null) {
  if (!addr) return null;
  if (addr.line) return addr.line;
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
  const [amendments, setAmendments] = useState<AmendmentRow[]>([]);
  const [amendsLoading, setAmendsLoading] = useState(false);

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
  const [mailAttachOpen, setMailAttachOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"sent" | "error" | null>(null);

  const quoteIds = new Set(customer.quotes.map(q => q.id));

  const loadAmendments = async () => {
    if (amendsLoading) return;
    setAmendsLoading(true);
    try {
      const endpoint = isAdmin
        ? `${API_BASE}/api/admin/amendments`
        : `${API_BASE}/api/amendments`;
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const d = (await res.json()) as { amendments: AmendmentRow[] };
      setAmendments(d.amendments.filter(a => quoteIds.has(a.originalQuoteId)));
    } catch {
      setAmendments([]);
    } finally {
      setAmendsLoading(false);
    }
  };

  // Load amendments on mount so the tab count is correct immediately
  useEffect(() => { void loadAmendments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if ((t === "amendments" || t === "email") && !amendsLoading) {
      void loadAmendments();
    }
  };

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
      const attachments: { type: "quote" | "amendment"; id: string; filename: string }[] = [];

      if (mailRef) {
        const [refType, refId] = mailRef.split(":");
        if (refType === "quote" && refId) {
          const refQ = customer.quotes.find(q => q.id === refId);
          if (refQ) {
            body += `\n\nAttached Quote: ${refQ.quoteNumber || "Untitled"}`;
            if (refQ.pdfSavedAt) {
              attachments.push({
                type: "quote",
                id: refId,
                filename: `${(refQ.quoteNumber || "quote").replace(/\s+/g, "-").toLowerCase()}.pdf`,
              });
            }
          }
        } else if (refType === "amendment" && refId) {
          const refA = amendments.find(a => a.id === refId);
          if (refA) {
            const origBase = (refA.originalQuoteNumber ?? "").replace(/^[Qq]-?/, "");
            const paddedNum = String(refA.amendmentNumber).padStart(3, "0");
            const fname = `AQ-${origBase || "AMEND"}_${paddedNum}.pdf`;
            body += `\n\nAttached Amendment: ${refA.quoteNumber || fname}`;
            if (refA.pdfSavedAt) {
              attachments.push({ type: "amendment", id: refId, filename: fname });
            }
          }
        }
      }

      const res = await fetch(`${API_BASE}/api/customers/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: mailTo,
          subject: mailSubject,
          body,
          attachments: attachments.length ? attachments : undefined,
        }),
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
    amendments: `Amendments (${amendments.length})`,
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
          {(["contact", "quotes", "amendments", "dashboard", "email"] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              className={`cdm-tab${tab === t ? " active" : ""}`}
              onClick={() => handleTabChange(t)}
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
                        onChange={e => setEditFields(f => ({ ...f, customerPhone: formatPhoneUS(e.target.value) }))}
                        placeholder="+1 (555) 000-0000"
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
                    {customer.mcn && (
                      <div className="cdm-contact-item">
                        <span className="cdm-contact-label">MCN</span>
                        <span className="cdm-contact-value">{customer.mcn}</span>
                      </div>
                    )}

                    {/* Contacts table */}
                    {(() => {
                      const seen = new Set<string>();
                      const contacts: { name: string; position: string; email: string; phone: string }[] = [];
                      for (const q of customer.quotes) {
                        const name = (q.data?.meta?.customerName as string | undefined) ?? "";
                        const position = (q.data?.meta?.customerPosition as string | undefined) ?? "";
                        const email = (q.data?.meta?.customerEmail as string | undefined) ?? "";
                        const phone = (q.data?.meta?.customerPhone as string | undefined) ?? "";
                        const key = `${name.toLowerCase()}|${email.toLowerCase()}`;
                        if ((name || email) && !seen.has(key)) {
                          seen.add(key);
                          contacts.push({ name, position, email, phone });
                        }
                      }
                      const pk = `${(customer.customerName ?? "").toLowerCase()}|${(customer.customerEmail ?? "").toLowerCase()}`;
                      if (!seen.has(pk) && (customer.customerName || customer.customerEmail)) {
                        contacts.unshift({ name: customer.customerName ?? "", position: "", email: customer.customerEmail ?? "", phone: customer.customerPhone ?? "" });
                      }
                      if (contacts.length === 0) return null;
                      return (
                        <div className="cdm-fua-table-wrap" style={{ gridColumn: "1 / -1" }}>
                          <table className="cdm-fua-table cdm-contacts-table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Position</th>
                                <th>Email</th>
                                <th>Phone</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contacts.map((c, i) => (
                                <tr key={i}>
                                  <td>{c.name || "—"}</td>
                                  <td>{c.position || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                                  <td>
                                    {c.email
                                      ? <a href={`mailto:${c.email}`} style={{ color: "var(--accent)" }}>{c.email}</a>
                                      : "—"}
                                  </td>
                                  <td>{c.phone || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    {/* FUA / DBA table */}
                    {(() => {
                      const seen = new Set<string>();
                      const units: { fua: number | undefined; dba: string | undefined }[] = [];
                      for (const q of customer.quotes) {
                        const f = q.data?.meta?.fua;
                        const d = q.data?.meta?.dba;
                        const key = `${f ?? ""}|${d ?? ""}`;
                        if ((f != null || (d && d.trim())) && !seen.has(key)) {
                          seen.add(key);
                          units.push({ fua: f, dba: d });
                        }
                      }
                      if (units.length === 0) return null;
                      return (
                        <div className="cdm-fua-table-wrap" style={{ gridColumn: "1 / -1" }}>
                          <table className="cdm-fua-table">
                            <thead>
                              <tr>
                                <th>FUA</th>
                                <th>DBA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {units.map((u, i) => (
                                <tr key={i}>
                                  <td>{u.fua != null ? String(u.fua) : "—"}</td>
                                  <td>{u.dba?.trim() || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
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

                  {(() => {
                    const salesRep = customer.quotes
                      .slice()
                      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                      .map((q) => q.data?.meta?.salesRep)
                      .find((s) => s && s.trim());
                    return (customer.creatorName || customer.creatorEmail || salesRep) ? (
                      <div className="cdm-contact-grid" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                        {customer.creatorName && (
                          <div className="cdm-contact-item">
                            <span className="cdm-contact-label">Account Rep</span>
                            <span className="cdm-contact-value">{customer.creatorName}</span>
                          </div>
                        )}
                        {salesRep && (
                          <div className="cdm-contact-item">
                            <span className="cdm-contact-label">Sales Rep</span>
                            <span className="cdm-contact-value">{salesRep}</span>
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
                    ) : null;
                  })()}

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

          {/* AMENDMENTS */}
          {tab === "amendments" && (
            <div className="cdm-section">
              {amendsLoading ? (
                <div className="admin-loading"><div className="spinner" /></div>
              ) : amendments.length === 0 ? (
                <div className="admin-table-empty">No amendments found for this customer's quotes.</div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Amendment #</th>
                        <th>Original Quote</th>
                        <th>Amendment Quote #</th>
                        <th style={{ textAlign: "right" }}>MRR Delta</th>
                        <th>Created</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {amendments
                        .slice()
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(a => (
                          <tr key={a.id}>
                            <td className="admin-td-bold" style={{ fontFamily: "monospace", fontSize: 12 }}>
                              {fmtAmendNum(a.amendmentNumber)}
                            </td>
                            <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-2)" }}>
                              {a.originalQuoteNumber || <span style={{ color: "var(--text-3)" }}>—</span>}
                            </td>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                              {a.quoteNumber || <span style={{ color: "var(--text-3)" }}>—</span>}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <MrrDeltaBadge value={a.data?.mrrDelta} />
                            </td>
                            <td style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                              {fmtDate(a.createdAt)}
                            </td>
                            <td style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                              {fmtDate(a.updatedAt)}
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
                {(customer.quotes.length > 0 || amendments.length > 0) && (() => {
                  // Build flat option list for lookup
                  type AttachOption = { value: string; label: string; hasPdf: boolean; group: string };
                  const options: AttachOption[] = [
                    { value: "", label: "None", hasPdf: false, group: "" },
                    ...customer.quotes.map(q => ({
                      value: `quote:${q.id}`,
                      label: `${q.quoteNumber || "Untitled"} — ${q.passStatus ? q.passStatus.toUpperCase() : "No Status"}`,
                      hasPdf: !!q.pdfSavedAt,
                      group: "Quotes",
                    })),
                    ...amendments.map(a => {
                      const origBase = (a.originalQuoteNumber ?? "").replace(/^[Qq]-?/, "");
                      const paddedNum = String(a.amendmentNumber).padStart(3, "0");
                      return {
                        value: `amendment:${a.id}`,
                        label: `AQ-${origBase || "AMEND"}_${paddedNum}`,
                        hasPdf: !!a.pdfSavedAt,
                        group: "Amendments",
                      };
                    }),
                  ];
                  const selected = options.find(o => o.value === mailRef) ?? options[0];
                  const groups = ["Quotes", "Amendments"].filter(g => options.some(o => o.group === g));

                  return (
                    <div className="cdm-form-field">
                      <label>Attach PDF</label>
                      <div className="cdm-attach-dropdown" style={{ position: "relative" }}>
                        {/* Trigger */}
                        <button
                          type="button"
                          className="cdm-attach-trigger"
                          onClick={() => setMailAttachOpen(v => !v)}
                        >
                          <span className="cdm-attach-trigger-content">
                            {selected.value && selected.hasPdf && (
                              <span className="cdm-pdf-badge">PDF</span>
                            )}
                            <span className="cdm-attach-trigger-label">
                              {selected.value ? selected.label : "None"}
                              {selected.value && !selected.hasPdf && (
                                <span className="cdm-attach-no-pdf"> (no PDF saved)</span>
                              )}
                            </span>
                          </span>
                          <svg className="cdm-attach-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>

                        {/* Dropdown panel */}
                        {mailAttachOpen && (
                          <>
                            <div className="cdm-attach-backdrop" onClick={() => setMailAttachOpen(false)} />
                            <div className="cdm-attach-panel">
                              {/* None option */}
                              <div
                                className={`cdm-attach-item${mailRef === "" ? " cdm-attach-item--selected" : ""}`}
                                onClick={() => { setMailRef(""); setMailAttachOpen(false); }}
                              >
                                <span className="cdm-attach-item-label">None</span>
                              </div>

                              {groups.map(g => (
                                <div key={g}>
                                  <div className="cdm-attach-group-label">{g}</div>
                                  {options.filter(o => o.group === g).map(o => (
                                    <div
                                      key={o.value}
                                      className={`cdm-attach-item${mailRef === o.value ? " cdm-attach-item--selected" : ""}`}
                                      onClick={() => { setMailRef(o.value); setMailAttachOpen(false); }}
                                    >
                                      {o.hasPdf
                                        ? <span className="cdm-pdf-badge">PDF</span>
                                        : <span className="cdm-pdf-badge cdm-pdf-badge--empty">PDF</span>
                                      }
                                      <span className="cdm-attach-item-label">
                                        {o.label}
                                        {!o.hasPdf && <span className="cdm-attach-no-pdf"> (no PDF saved)</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {mailRef && (() => {
                        const [rType, rId] = mailRef.split(":");
                        const hasPdf = rType === "quote"
                          ? customer.quotes.find(q => q.id === rId)?.pdfSavedAt
                          : amendments.find(a => a.id === rId)?.pdfSavedAt;
                        return !hasPdf ? (
                          <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                            No PDF saved — save it first using "Save PDF" in the quote or amendment.
                          </p>
                        ) : null;
                      })()}
                    </div>
                  );
                })()}
                <div className="cdm-form-field">
                  <label>Message</label>
                  <RichTextEditor
                    value={mailBody}
                    onChange={setMailBody}
                    placeholder="Write your message here…"
                    minHeight={160}
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
