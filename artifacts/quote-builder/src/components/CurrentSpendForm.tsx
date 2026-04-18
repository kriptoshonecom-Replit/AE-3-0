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

        {/* Field 1 — dollar prefix */}
        <div className="field-group">
          <label>AE Current Monthly Spend</label>
          <div className="price-input-wrap">
            <span className="price-prefix">$</span>
            <input
              type="text"
              className="price-input"
              style={{ textAlign: "left", paddingLeft: "2px" }}
              value={meta.aeCurrentMonthlySpend ?? ""}
              onChange={set("aeCurrentMonthlySpend")}
              placeholder="1 if New Customer"
            />
          </div>
        </div>

        {/* Field 2 — dollar prefix */}
        <div className="field-group">
          <label>AE Current Voyix Pay Spend</label>
          <div className="price-input-wrap">
            <span className="price-prefix">$</span>
            <input
              type="text"
              className="price-input"
              style={{ textAlign: "left", paddingLeft: "2px" }}
              value={meta.aeCurrentVoyixPaySpend ?? ""}
              onChange={set("aeCurrentVoyixPaySpend")}
              placeholder="1 if New Customer"
            />
          </div>
        </div>

        {/* Field 3 — percent suffix */}
        <div className="field-group">
          <label>Existing Headline Rate</label>
          <div className="price-input-wrap">
            <input
              type="text"
              className="price-input"
              style={{ textAlign: "left", paddingLeft: "8px" }}
              value={meta.existingHeadlineRate ?? ""}
              onChange={set("existingHeadlineRate")}
              placeholder="If Applicable (ex. 3.1)"
            />
            <span className="input-suffix">%</span>
          </div>
        </div>

        {/* Field 4 — basis points suffix */}
        <div className="field-group">
          <label>Existing Interchange Rate</label>
          <div className="price-input-wrap">
            <input
              type="text"
              className="price-input"
              style={{ textAlign: "left", paddingLeft: "8px" }}
              value={meta.existingInterchangeRate ?? ""}
              onChange={set("existingInterchangeRate")}
              placeholder="If Applicable (ex. 42)"
            />
            <span className="input-suffix">bps</span>
          </div>
        </div>

      </div>
    </div>
  );
}
