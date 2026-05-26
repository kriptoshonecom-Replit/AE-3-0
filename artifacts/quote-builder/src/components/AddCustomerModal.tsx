import { useState } from "react";
import type { CustomerProfile } from "../pages/CDMPage";
import { formatPhoneUS } from "../utils/phone";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface Props {
  onClose: () => void;
  onCreated: (customer: CustomerProfile) => void;
}

interface AddrFields {
  name: string;
  number: string;
  line: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const emptyAddr = (): AddrFields => ({ name: "", number: "", line: "", city: "", state: "", zip: "", country: "United States" });

function AddressSection({ title, value, onChange }: {
  title: string;
  value: AddrFields;
  onChange: (v: AddrFields) => void;
}) {
  const set = (k: keyof AddrFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div>
      <div className="edit-section-label">{title}</div>
      <div className="meta-grid">
        <div className="field-group">
          <label>Name</label>
          <input type="text" value={value.name} onChange={set("name")} placeholder="Business or contact name" />
        </div>
        <div className="field-group">
          <label>Street Number</label>
          <input type="text" value={value.number} onChange={set("number")} placeholder="123" />
        </div>
        <div className="field-group" style={{ gridColumn: "span 2" }}>
          <label>Street Line</label>
          <input type="text" value={value.line} onChange={set("line")} placeholder="Main Street" />
        </div>
        <div className="field-group">
          <label>City</label>
          <input type="text" value={value.city} onChange={set("city")} placeholder="City" />
        </div>
        <div className="field-group">
          <label>State</label>
          <input type="text" value={value.state} onChange={set("state")} placeholder="State" />
        </div>
        <div className="field-group">
          <label>Zip Code</label>
          <input type="text" value={value.zip} onChange={set("zip")} placeholder="00000" />
        </div>
        <div className="field-group">
          <label>Country</label>
          <input type="text" value={value.country} onChange={set("country")} />
        </div>
      </div>
    </div>
  );
}

export default function AddCustomerModal({ onClose, onCreated }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [mcn, setMcn] = useState("");
  const [fua, setFua] = useState("");
  const [dba, setDba] = useState("");
  const [salesRep, setSalesRep] = useState("");
  const [businessOperation, setBusinessOperation] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [address, setAddress] = useState<AddrFields>(emptyAddr());
  const [billTo, setBillTo] = useState<AddrFields>(emptyAddr());
  const [sameAsBusiness, setSameAsBusiness] = useState(false);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!companyName.trim() && !customerName.trim() && !mcn.trim() && !customerEmail.trim()) {
      setError("Provide at least a company name, customer name, MCN, or email.");
      return;
    }

    const hasAddress = address.city || address.name || address.number;
    const hasBilling = !sameAsBusiness && (billTo.city || billTo.name || billTo.number);

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyName: companyName.trim() || undefined,
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          mcn: mcn.trim() || undefined,
          salesRep: salesRep.trim() || undefined,
          fua: fua ? Number(fua) : undefined,
          dba: dba.trim() || undefined,
          businessOperation: businessOperation.trim() || undefined,
          validUntil: validUntil || undefined,
          address: hasAddress ? address : null,
          billingAddress: sameAsBusiness ? address : hasBilling ? billTo : null,
        }),
      });
      const data = await res.json() as { customer?: CustomerProfile; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create customer"); return; }
      if (data.customer) onCreated(data.customer);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal" style={{ maxWidth: 680, width: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="admin-modal-header">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Add Customer</h3>
          <button type="button" className="btn-icon" onClick={onClose} style={{ marginLeft: "auto" }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="admin-modal-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Customer Info */}
            <div>
              <div className="edit-section-label">Customer Info</div>
              <div className="meta-grid">
                <div className="field-group">
                  <label>MCN</label>
                  <input type="text" inputMode="numeric" value={mcn} onChange={e => setMcn(e.target.value)} placeholder="0" />
                </div>
                <div className="field-group">
                  <label>FUA</label>
                  <input type="text" value={fua} onChange={e => setFua(e.target.value)} placeholder="0" />
                </div>
                <div className="field-group">
                  <label>DBA</label>
                  <input type="text" value={dba} onChange={e => setDba(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Sales Rep</label>
                  <input type="text" value={salesRep} onChange={e => setSalesRep(e.target.value)} placeholder="e.g. Jane Smith" />
                </div>
                <div className="field-group">
                  <label>Company Name</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div className="field-group">
                  <label>Business Operation</label>
                  <input type="text" value={businessOperation} onChange={e => setBusinessOperation(e.target.value)} placeholder="e.g. Full Service Restaurant" />
                </div>
                <div className="field-group">
                  <label>Customer Name</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="John Smith" />
                </div>
                <div className="field-group">
                  <label>Customer Email</label>
                  <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="contact@acme.com" />
                </div>
                <div className="field-group">
                  <label>Customer Phone</label>
                  <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(formatPhoneUS(e.target.value))} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="field-group">
                  <label>Valid Until</label>
                  <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Business Address */}
            <AddressSection title="Business Address" value={address} onChange={setAddress} />

            {/* Bill To Address */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div className="edit-section-label" style={{ margin: 0 }}>Bill To Address</div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={sameAsBusiness}
                    onChange={e => setSameAsBusiness(e.target.checked)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  Same as business address
                </label>
              </div>
              {!sameAsBusiness && (
                <AddressSection title="" value={billTo} onChange={setBillTo} />
              )}
            </div>

            {error && <div className="edit-modal-error">{error}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="admin-btn-add-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="admin-btn-add" disabled={saving}>
                {saving ? "Creating…" : "Create Customer"}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
