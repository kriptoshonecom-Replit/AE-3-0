import React, { useState } from "react";
import type { QuoteMeta } from "../types";

interface Props {
  meta: QuoteMeta;
  onChange: (meta: QuoteMeta) => void;
}

function formatUSD(raw: string): string {
  const num = parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return raw;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function stripFormat(value: string): string {
  return value.replace(/[^0-9.]/g, "");
}

export default function CurrentSpendForm({ meta, onChange }: Props) {
  const [monthlyFocused, setMonthlyFocused] = useState(false);

  const set = (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...meta, [key]: e.target.value });
  };

  const rawMonthly = meta.aeCurrentMonthlySpend ?? "";
  const displayMonthly =
    !monthlyFocused && rawMonthly !== "" ? formatUSD(rawMonthly) : rawMonthly;

  return (
    <div className="quote-meta-form">
      <div className="meta-grid">

        <div className="field-group">
          <label>Aloha Essentials Current Monthly Spend</label>
          <input
            type="text"
            value={displayMonthly}
            placeholder="Type 1 if New Customer"
            onFocus={(e) => {
              setMonthlyFocused(true);
              const stripped = stripFormat(e.target.value);
              onChange({ ...meta, aeCurrentMonthlySpend: stripped });
            }}
            onChange={(e) => onChange({ ...meta, aeCurrentMonthlySpend: e.target.value })}
            onBlur={(e) => {
              setMonthlyFocused(false);
              const stripped = stripFormat(e.target.value);
              onChange({ ...meta, aeCurrentMonthlySpend: stripped });
            }}
          />
        </div>

        <div className="field-group">
          <label>Aloha Essentials Current Voyix Pay Spend</label>
          <input
            type="text"
            value={meta.aeCurrentVoyixPaySpend ?? ""}
            onChange={set("aeCurrentVoyixPaySpend")}
            placeholder="Type 1 if New Customer"
          />
        </div>

        <div className="field-group">
          <label>Existing Headline Rate</label>
          <input
            type="text"
            value={meta.existingHeadlineRate ?? ""}
            onChange={set("existingHeadlineRate")}
            placeholder="If Applicable"
          />
        </div>

        <div className="field-group">
          <label>Existing Interchange Rate</label>
          <input
            type="text"
            value={meta.existingInterchangeRate ?? ""}
            onChange={set("existingInterchangeRate")}
            placeholder="If Applicable"
          />
        </div>

      </div>
    </div>
  );
}
