import { useState } from "react";
import { X } from "lucide-react";
import type { CustomerProfile } from "../pages/CDMPage";
import { formatPhoneUS } from "../utils/phone";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface Props {
  onClose: () => void;
  onCreated: (customer: CustomerProfile) => void;
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
  const [addressLine, setAddressLine] = useState("");
  const [sameForBilling, setSameForBilling] = useState(true);
  const [billingAddressLine, setBillingAddressLine] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!companyName.trim() && !customerName.trim() && !mcn.trim() && !customerEmail.trim()) {
      setError("Provide at least a company name, customer name, MCN, or email.");
      return;
    }

    const addr = addressLine.trim()
      ? { line: addressLine.trim(), name: "", number: "", city: "", state: "", zip: "", country: "" }
      : null;
    const billing = sameForBilling
      ? addr
      : billingAddressLine.trim()
        ? { line: billingAddressLine.trim(), name: "", number: "", city: "", state: "", zip: "", country: "" }
        : null;

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
          address: addr,
          billingAddress: billing,
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
      <div className="admin-modal" style={{ maxWidth: 620, width: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="admin-modal-header">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Add Customer</h3>
          <button type="button" className="btn-icon" onClick={onClose} style={{ marginLeft: "auto" }}>
            <X size={13} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="admin-modal-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Customer Info */}
            <div className="quote-meta-form">
              <div className="meta-grid">
                <div className="field-group">
                  <label>MCN</label>
                  <input type="text" inputMode="numeric" value={mcn} onChange={e => setMcn(e.target.value)} placeholder="1234567" />
                </div>
                <div className="field-group">
                  <label>FUA</label>
                  <input type="text" value={fua} onChange={e => setFua(e.target.value)} placeholder="1234567" />
                </div>
                <div className="field-group">
                  <label>DBA</label>
                  <input type="text" value={dba} onChange={e => setDba(e.target.value)} placeholder="Doing Business As" />
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
              </div>
            </div>

            {/* Address — same single-line style as quote builder */}
            <div className="address-section">
              <div className="field-group">
                <label>Address</label>
                <input
                  type="text"
                  value={addressLine}
                  onChange={e => setAddressLine(e.target.value)}
                  placeholder="e.g. 123 Main St, Atlanta, GA 30301"
                />
              </div>

              <label className="address-billing-toggle">
                <input
                  type="checkbox"
                  checked={sameForBilling}
                  onChange={e => setSameForBilling(e.target.checked)}
                />
                <span>Same for Billing</span>
              </label>

              {!sameForBilling && (
                <div className="address-billing-section">
                  <div className="address-billing-title">Billing Operation Address</div>
                  <div className="field-group">
                    <label>Billing Address</label>
                    <input
                      type="text"
                      value={billingAddressLine}
                      onChange={e => setBillingAddressLine(e.target.value)}
                      placeholder="e.g. 456 Oak Ave, Atlanta, GA 30301"
                    />
                  </div>
                </div>
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
