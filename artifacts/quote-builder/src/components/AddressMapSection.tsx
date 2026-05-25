interface AddressFields {
  addressLine: string;
  addressName: string;
  addressNumber: string;
  addressCity: string;
  addressState: string;
  zipCode: string;
  addressCountry: string;
}

interface BillingFields {
  billingAddressLine: string;
  billingAddressName: string;
  billingAddressNumber: string;
  billingAddressCity: string;
  billingAddressState: string;
  billingZipCode: string;
  billingAddressCountry: string;
}

interface Props {
  values: AddressFields;
  onChange: (fields: Partial<AddressFields>) => void;
  sameForBilling?: boolean;
  billingValues?: Partial<BillingFields>;
  onBillingChange?: (fields: Partial<BillingFields & { sameForBilling: boolean }>) => void;
}

export default function AddressMapSection({
  values, onChange,
  sameForBilling = true, billingValues = {}, onBillingChange,
}: Props) {
  return (
    <div className="address-section">

      <div className="field-group">
        <label>Address</label>
        <input
          type="text"
          value={values.addressLine}
          onChange={(e) => onChange({ addressLine: e.target.value })}
          placeholder="e.g. 123 Main St, Atlanta, GA 30301"
        />
      </div>

      <label className="address-billing-toggle">
        <input
          type="checkbox"
          checked={sameForBilling}
          onChange={(e) => onBillingChange?.({ sameForBilling: e.target.checked })}
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
              value={billingValues.billingAddressLine ?? ""}
              onChange={(e) => onBillingChange?.({ billingAddressLine: e.target.value })}
              placeholder="e.g. 456 Oak Ave, Atlanta, GA 30301"
            />
          </div>
        </div>
      )}
    </div>
  );
}
