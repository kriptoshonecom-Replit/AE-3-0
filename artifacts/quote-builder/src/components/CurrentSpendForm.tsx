import React from "react";
import type { QuoteMeta } from "../types";

interface Props {
  meta: QuoteMeta;
  onChange: (meta: QuoteMeta) => void;
}

export default function CurrentSpendForm({ meta, onChange }: Props) {
  const set = (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...meta, [key]: e.target.value });
  };

  return (
    <div className="quote-meta-form">
      <div className="meta-grid">
        <div className="field-group">
          <label>AE Current Monthly Spend</label>
          <input
            type="text"
            value={meta.aeCurrentMonthlySpend ?? ""}
            onChange={set("aeCurrentMonthlySpend")}
            placeholder="Enter $1 if New Customer"
          />
        </div>

        <div className="field-group">
          <label>AE Current Voyix Pay Spend</label>
          <input
            type="text"
            value={meta.aeCurrentVoyixPaySpend ?? ""}
            onChange={set("aeCurrentVoyixPaySpend")}
            placeholder="Enter $1 if New Customer"
          />
        </div>

        <div className="field-group">
          <label>Existing Headline Rate</label>
          <input
            type="text"
            value={meta.existingHeadlineRate ?? ""}
            onChange={set("existingHeadlineRate")}
            placeholder="If Applicable (ex. 3.1%)"
          />
        </div>

        <div className="field-group">
          <label>Existing Interchange Rate</label>
          <input
            type="text"
            value={meta.existingInterchangeRate ?? ""}
            onChange={set("existingInterchangeRate")}
            placeholder="If Applicable (ex. 42 Basis Points)"
          />
        </div>
      </div>
    </div>
  );
}
