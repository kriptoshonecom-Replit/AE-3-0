import { useState, useEffect, useMemo } from "react";
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

interface EditRow {
  name: string;
  position: string;
  email: string;
  phone: string;
  fua: string;
  dba: string;
  addressLine: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  quoteIds: string[];
  dirty: boolean;
}

function fmtCompactAddr(line: string, city: string, state: string, zip: string): string {
  const cityLine = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");
  return [line, cityLine].filter(Boolean).join(", ");
}

function buildEditRows(customer: CustomerProfile): EditRow[] {
  const map = new Map<string, EditRow>();
  for (const q of customer.quotes) {
    const name = (q.data?.meta?.customerName as string | undefined) ?? "";
    const position = (q.data?.meta?.customerPosition as string | undefined) ?? "";
    const email = (q.data?.meta?.customerEmail as string | undefined) ?? "";
    const phone = (q.data?.meta?.customerPhone as string | undefined) ?? "";
    const fuaRaw = q.data?.meta?.fua as number | undefined;
    const fua = fuaRaw != null ? String(fuaRaw) : "";
    const dba = (q.data?.meta?.dba as string | undefined) ?? "";
    const addressLine = (q.data?.meta?.addressLine as string | undefined) ?? "";
    const addressCity = (q.data?.meta?.addressCity as string | undefined) ?? "";
    const addressState = (q.data?.meta?.addressState as string | undefined) ?? "";
    const addressZip = (q.data?.meta?.zipCode as string | undefined) ?? "";
    const key = `${name.toLowerCase()}|${email.toLowerCase()}|${fua}|${dba}`;
    if (name || email || fua || dba.trim()) {
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.quoteIds.push(q.id);
        // Prefer the row with the most address detail
        if (!existing.addressLine && addressLine) {
          existing.addressLine = addressLine;
          existing.addressCity = addressCity;
          existing.addressState = addressState;
          existing.addressZip = addressZip;
        }
      } else {
        map.set(key, { name, position, email, phone, fua, dba, addressLine, addressCity, addressState, addressZip, quoteIds: [q.id], dirty: false });
      }
    }
  }
  const rows = Array.from(map.values());
  // Add a primary row from the customer record only if no quote row already
  // covers the same email address — prevents a ghost duplicate when the name
  // was edited via a row-save but the customers table hasn't been updated yet.
  const primaryEmail = (customer.customerEmail ?? "").toLowerCase();
  const alreadyCovered = rows.some(r => r.email.toLowerCase() === primaryEmail && primaryEmail !== "");
  if (!alreadyCovered && (customer.customerName || customer.customerEmail)) {
    rows.unshift({
      name: customer.customerName ?? "",
      position: "",
      email: customer.customerEmail ?? "",
      phone: customer.customerPhone ?? "",
      fua: "",
      dba: "",
      addressLine: customer.address?.line ?? "",
      addressCity: customer.address?.city ?? "",
      addressState: customer.address?.state ?? "",
      addressZip: customer.address?.zip ?? "",
      quoteIds: [],
      dirty: false,
    });
  }
  return rows;
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

  const [custKpis, setCustKpis] = useState<{
    passPaymentsRevMo: number; passGatewayRevMo: number;
    totalPaymentsRevMo: number; totalGatewayRevMo: number;
    passTotalSites: number; allTotalSites: number;
  } | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [editRows, setEditRows] = useState<EditRow[]>(() => buildEditRows(customer));
  const [rowSaving, setRowSaving] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const contactEmails = useMemo(() => {
    const seen = new Set<string>();
    const out: { email: string; name: string }[] = [];
    for (const r of editRows) {
      const e = r.email.trim().toLowerCase();
      if (e && !seen.has(e)) { seen.add(e); out.push({ email: r.email.trim(), name: r.name }); }
    }
    return out;
  }, [editRows]);

  const [mailToSet, setMailToSet] = useState<Set<string>>(
    () => new Set(customer.customerEmail ? [customer.customerEmail] : [])
  );
  const [mailToCustom, setMailToCustom] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailRefs, setMailRefs] = useState<Set<string>>(new Set());
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

  const loadCustKpis = async () => {
    if (custKpis || kpisLoading) return;
    setKpisLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${encodeURIComponent(customer.key)}/kpis`,
        { credentials: "include" }
      );
      if (res.ok) setCustKpis(await res.json() as typeof custKpis);
    } finally {
      setKpisLoading(false);
    }
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if ((t === "amendments" || t === "email") && !amendsLoading) {
      void loadAmendments();
    }
    if (t === "dashboard" && isAdmin) void loadCustKpis();
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
      // Keep the primary row in editRows in sync with the saved top-form fields
      setEditRows(rows => rows.map(r =>
        r.quoteIds.length === 0
          ? { ...r, name: editFields.customerName, email: editFields.customerEmail, phone: editFields.customerPhone }
          : r
      ));
      onSaved({ ...customer, ...editFields });
      setEditing(false);
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRow = async (idx: number) => {
    const row = editRows[idx];
    if (!row.quoteIds.length) return;
    setRowSaving(s => new Set([...s, idx]));
    setRowErrors(e => { const n = { ...e }; delete n[idx]; return n; });
    try {
      const saves: Promise<void>[] = row.quoteIds.map(qid =>
        fetch(`${API_BASE}/api/admin/quotes/${qid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            meta: {
              customerName: row.name,
              customerPosition: row.position || undefined,
              customerEmail: row.email,
              customerPhone: row.phone || undefined,
              fua: row.fua ? Number(row.fua) : undefined,
              dba: row.dba.trim() || undefined,
              addressLine: row.addressLine || undefined,
              addressCity: row.addressCity || undefined,
              addressState: row.addressState || undefined,
              zipCode: row.addressZip || undefined,
            },
          }),
        }).then(r => { if (!r.ok) throw new Error("Failed"); })
      );

      // If this row is the primary contact (same email as the customer record,
      // or it's the only row), also sync the customers table so the values
      // survive a page refresh without reverting to the old stored record.
      const isPrimary =
        row.email.toLowerCase() === (customer.customerEmail ?? "").toLowerCase() ||
        editRows.filter(r => r.quoteIds.length > 0).length === 1;
      if (isPrimary) {
        saves.push(
          fetch(`${API_BASE}/api/admin/customers/${encodeURIComponent(customer.key)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              customerName: row.name,
              customerEmail: row.email,
              customerPhone: row.phone || undefined,
            }),
          }).then(r => { if (!r.ok) throw new Error("Customer sync failed"); })
        );
      }

      await Promise.all(saves);
      setEditRows(rows => rows.map((r, i) => i === idx ? { ...r, dirty: false } : r));
    } catch {
      setRowErrors(e => ({ ...e, [idx]: "Save failed. Try again." }));
    } finally {
      setRowSaving(s => { const n = new Set(s); n.delete(idx); return n; });
    }
  };

  const handleSendMail = async () => {
    const mailTo = [...mailToSet].join(", ");
    if (!mailToSet.size || !mailSubject || !mailBody) return;
    setSending(true);
    setSendResult(null);
    try {
      let body = mailBody;
      const attachments: { type: "quote" | "amendment"; id: string; filename: string }[] = [];

      for (const ref of mailRefs) {
        const [refType, refId] = ref.split(":");
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
      setMailRefs(new Set());
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

                  {/* Contacts editable table */}
                  {editRows.length > 0 && (
                    <div className="cdm-fua-table-wrap" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                      <table className="cdm-fua-table cdm-contacts-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Position</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>FUA</th>
                            <th>DBA</th>
                            <th>Service Address</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {editRows.map((r, i) => (
                            <tr key={i}>
                              <td>
                                <input
                                  className="cdm-cell-input"
                                  value={r.name}
                                  placeholder="Name"
                                  onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, name: e.target.value, dirty: true } : row))}
                                />
                              </td>
                              <td>
                                <select
                                  className="cdm-cell-input"
                                  value={r.position}
                                  onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, position: e.target.value, dirty: true } : row))}
                                >
                                  <option value="">—</option>
                                  <option>CEO</option>
                                  <option>COO</option>
                                  <option>CFO</option>
                                  <option>CTO</option>
                                  <option>GM</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  className="cdm-cell-input"
                                  type="email"
                                  value={r.email}
                                  placeholder="Email"
                                  onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, email: e.target.value, dirty: true } : row))}
                                />
                              </td>
                              <td>
                                <input
                                  className="cdm-cell-input"
                                  value={r.phone}
                                  placeholder="Phone"
                                  onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, phone: formatPhoneUS(e.target.value), dirty: true } : row))}
                                />
                              </td>
                              <td>
                                <input
                                  className="cdm-cell-input"
                                  inputMode="numeric"
                                  value={r.fua}
                                  placeholder="—"
                                  onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, fua: e.target.value, dirty: true } : row))}
                                />
                              </td>
                              <td>
                                <input
                                  className="cdm-cell-input"
                                  value={r.dba}
                                  placeholder="—"
                                  onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, dba: e.target.value, dirty: true } : row))}
                                />
                              </td>
                              <td className="cdm-addr-cell">
                                <input
                                  className="cdm-cell-input"
                                  value={r.addressLine}
                                  placeholder="Street"
                                  onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, addressLine: e.target.value, dirty: true } : row))}
                                />
                                <div className="cdm-addr-row2">
                                  <input
                                    className="cdm-cell-input cdm-cell-city"
                                    value={r.addressCity}
                                    placeholder="City"
                                    onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, addressCity: e.target.value, dirty: true } : row))}
                                  />
                                  <input
                                    className="cdm-cell-input cdm-cell-state"
                                    value={r.addressState}
                                    placeholder="ST"
                                    onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, addressState: e.target.value, dirty: true } : row))}
                                  />
                                  <input
                                    className="cdm-cell-input cdm-cell-zip"
                                    value={r.addressZip}
                                    placeholder="ZIP"
                                    onChange={e => setEditRows(rows => rows.map((row, j) => j === i ? { ...row, addressZip: e.target.value, dirty: true } : row))}
                                  />
                                </div>
                              </td>
                              <td style={{ whiteSpace: "nowrap", paddingLeft: 6 }}>
                                {r.quoteIds.length > 0 ? (
                                  <>
                                    {rowErrors[i] && <span style={{ color: "#ef4444", fontSize: 10, display: "block", marginBottom: 2 }}>{rowErrors[i]}</span>}
                                    <button
                                      type="button"
                                      className="admin-btn-edit"
                                      style={{ padding: "3px 10px", fontSize: 11, opacity: r.dirty ? 1 : 0.4 }}
                                      disabled={!r.dirty || rowSaving.has(i)}
                                      onClick={() => void handleSaveRow(i)}
                                    >
                                      {rowSaving.has(i) ? "…" : "Save"}
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>primary</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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

                    {/* Contacts + FUA/DBA merged table — driven by editRows so saved values reflect immediately */}
                    {editRows.length > 0 && (
                      <div className="cdm-fua-table-wrap" style={{ gridColumn: "1 / -1" }}>
                        <table className="cdm-fua-table cdm-contacts-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Position</th>
                              <th>Email</th>
                              <th>Phone</th>
                              <th>FUA</th>
                              <th>DBA</th>
                              <th>Service Address</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editRows.map((r, i) => (
                              <tr key={i}>
                                <td>{r.name || "—"}</td>
                                <td>{r.position || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                                <td>
                                  {r.email
                                    ? <a href={`mailto:${r.email}`} style={{ color: "var(--accent)" }}>{r.email}</a>
                                    : "—"}
                                </td>
                                <td>{r.phone || "—"}</td>
                                <td>{r.fua || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                                <td>{r.dba?.trim() || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  {fmtCompactAddr(r.addressLine, r.addressCity, r.addressState, r.addressZip) || <span style={{ color: "var(--text-3)" }}>—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
                {/* Left column — donut + stat grid */}
                <div className="cdm-dashboard-left">
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

                {/* Right column — Payments + Gateway revenue KPI cards */}
                {isAdmin && (
                  <div className="cdm-dashboard-right">
                    {kpisLoading && (
                      <div style={{ color: "var(--text-3)", fontSize: 13, paddingTop: 8 }}>Loading revenue data…</div>
                    )}
                    {custKpis && (() => {
                      function fmtRev(n: number) {
                        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
                        if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
                        return `$${n.toFixed(0)}`;
                      }
                      return (
                        <>
                          {custKpis.totalPaymentsRevMo > 0 && (
                            <div className="db-kpi-card">
                              <div className="db-kpi-header">
                                <span className="db-kpi-label">Payments Revenue</span>
                                <span style={{ color: "#16a34a", opacity: 0.75 }}>
                                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                                    <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M2 9h16" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M6 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                  </svg>
                                </span>
                              </div>
                              <div className="db-kpi-value" style={{ color: "#16a34a" }}>
                                {fmtRev(custKpis.passPaymentsRevMo)}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)" }}>/mo</span>
                              </div>
                              <div className="db-kpi-sub">
                                {custKpis.passTotalSites > 0 ? `${fmtRev(custKpis.passPaymentsRevMo / custKpis.passTotalSites)}/site · ` : ""}
                                {custKpis.passTotalSites} won site{custKpis.passTotalSites !== 1 ? "s" : ""}
                              </div>
                              <div className="db-kpi-breakdown">
                                <span className="db-kpi-pass">Won {fmtRev(custKpis.passPaymentsRevMo)}</span>
                                <span style={{ fontSize: 11, color: "var(--text-3)" }}>Pipeline {fmtRev(custKpis.totalPaymentsRevMo)}</span>
                              </div>
                            </div>
                          )}
                          {custKpis.totalGatewayRevMo > 0 && (
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
                                {fmtRev(custKpis.passGatewayRevMo)}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)" }}>/mo</span>
                              </div>
                              <div className="db-kpi-sub">
                                {custKpis.passTotalSites > 0 ? `${fmtRev(custKpis.passGatewayRevMo / custKpis.passTotalSites)}/site · ` : ""}
                                {custKpis.passTotalSites} won site{custKpis.passTotalSites !== 1 ? "s" : ""}
                              </div>
                              <div className="db-kpi-breakdown">
                                <span className="db-kpi-pass">Won {fmtRev(custKpis.passGatewayRevMo)}</span>
                                <span style={{ fontSize: 11, color: "var(--text-3)" }}>Pipeline {fmtRev(custKpis.totalGatewayRevMo)}</span>
                              </div>
                            </div>
                          )}
                          {custKpis.totalPaymentsRevMo === 0 && custKpis.totalGatewayRevMo === 0 && (
                            <div style={{ color: "var(--text-3)", fontSize: 12, paddingTop: 8 }}>
                              No payments or gateway revenue data for this customer.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EMAIL */}
          {tab === "email" && (
            <div className="cdm-section">
              <div className="cdm-mail-form">
                {/* Recipient checkboxes */}
                <div className="cdm-form-field">
                  <label>To</label>
                  {contactEmails.length > 0 && (
                    <div className="cdm-recipient-list">
                      {contactEmails.map(({ email, name }) => {
                        const checked = [...mailToSet].some(e => e.trim().toLowerCase() === email.toLowerCase());
                        return (
                          <label key={email} className="cdm-recipient-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setMailToSet(prev => {
                                  const next = new Set(prev);
                                  const key = email.toLowerCase();
                                  const existing = [...next].find(e => e.toLowerCase() === key);
                                  if (existing) next.delete(existing); else next.add(email);
                                  return next;
                                });
                              }}
                            />
                            <span className="cdm-recipient-email">{email}</span>
                            {name && <span className="cdm-recipient-name">{name}</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="cdm-recipient-custom">
                    <input
                      type="email"
                      value={mailToCustom}
                      onChange={e => setMailToCustom(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = mailToCustom.trim();
                          if (v) { setMailToSet(prev => new Set([...prev, v])); setMailToCustom(""); }
                        }
                      }}
                      placeholder="Add email address…"
                    />
                    <button
                      type="button"
                      className="cdm-recipient-add-btn"
                      disabled={!mailToCustom.trim()}
                      onClick={() => {
                        const v = mailToCustom.trim();
                        if (v) { setMailToSet(prev => new Set([...prev, v])); setMailToCustom(""); }
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  {[...mailToSet]
                    .filter(e => !contactEmails.some(c => c.email.toLowerCase() === e.toLowerCase()))
                    .map(e => (
                      <div key={e} className="cdm-recipient-custom-tag">
                        <span>{e}</span>
                        <button
                          type="button"
                          onClick={() => setMailToSet(prev => { const n = new Set(prev); n.delete(e); return n; })}
                        >×</button>
                      </div>
                    ))
                  }
                  {mailToSet.size > 0 && (
                    <div className="cdm-recipient-summary">
                      Sending to: {[...mailToSet].join(", ")}
                    </div>
                  )}
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
                  type AttachOption = { value: string; label: string; hasPdf: boolean; group: string };
                  const options: AttachOption[] = [
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
                  const groups = ["Quotes", "Amendments"].filter(g => options.some(o => o.group === g));
                  const selectedOptions = options.filter(o => mailRefs.has(o.value));
                  const missingPdf = selectedOptions.filter(o => !o.hasPdf);

                  const toggleRef = (val: string) => {
                    setMailRefs(prev => {
                      const next = new Set(prev);
                      if (next.has(val)) next.delete(val); else next.add(val);
                      return next;
                    });
                  };

                  return (
                    <div className="cdm-form-field">
                      <label>Attach PDFs</label>
                      <div className="cdm-attach-dropdown" style={{ position: "relative" }}>
                        {/* Trigger */}
                        <button
                          type="button"
                          className="cdm-attach-trigger"
                          onClick={() => setMailAttachOpen(v => !v)}
                        >
                          <span className="cdm-attach-trigger-content">
                            {mailRefs.size === 0 ? (
                              <span className="cdm-attach-trigger-label" style={{ color: "var(--text-3)" }}>None selected</span>
                            ) : (
                              <span className="cdm-attach-trigger-label">
                                {mailRefs.size} attachment{mailRefs.size !== 1 ? "s" : ""} selected
                              </span>
                            )}
                          </span>
                          <svg className="cdm-attach-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>

                        {/* Multi-select panel */}
                        {mailAttachOpen && (
                          <>
                            <div className="cdm-attach-backdrop" onClick={() => setMailAttachOpen(false)} />
                            <div className="cdm-attach-panel">
                              {groups.map(g => (
                                <div key={g}>
                                  <div className="cdm-attach-group-label">{g}</div>
                                  {options.filter(o => o.group === g).map(o => (
                                    <label
                                      key={o.value}
                                      className={`cdm-attach-item cdm-attach-item--check${mailRefs.has(o.value) ? " cdm-attach-item--selected" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={mailRefs.has(o.value)}
                                        onChange={() => toggleRef(o.value)}
                                      />
                                      {o.hasPdf
                                        ? <span className="cdm-pdf-badge">PDF</span>
                                        : <span className="cdm-pdf-badge cdm-pdf-badge--empty">PDF</span>
                                      }
                                      <span className="cdm-attach-item-label">
                                        {o.label}
                                        {!o.hasPdf && <span className="cdm-attach-no-pdf"> (no PDF saved)</span>}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Selected tags */}
                      {selectedOptions.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                          {selectedOptions.map(o => (
                            <div key={o.value} className="cdm-recipient-custom-tag">
                              {o.hasPdf && <span className="cdm-pdf-badge" style={{ fontSize: 9, padding: "1px 4px" }}>PDF</span>}
                              <span>{o.label}</span>
                              <button type="button" onClick={() => toggleRef(o.value)}>×</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {missingPdf.length > 0 && (
                        <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                          {missingPdf.length === 1
                            ? `"${missingPdf[0].label}" has no PDF saved — save it first in the quote builder.`
                            : `${missingPdf.length} selected items have no PDF saved yet.`}
                        </p>
                      )}
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
                    onClick={() => { setMailSubject(""); setMailBody(""); setMailRefs(new Set()); setSendResult(null); }}
                  >
                    Clear
                  </button>
                  <button
                    className="admin-btn-edit"
                    style={{ padding: "7px 20px" }}
                    type="button"
                    onClick={() => void handleSendMail()}
                    disabled={sending || !mailToSet.size || !mailSubject || !mailBody}
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
