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

function useBpsField(value: string, onChange: (val: string) => void) {
  const [focused, setFocused] = useState(false);
  const raw = value.replace(/[^0-9.]/g, "");
  const display =
    !focused && raw !== "" ? `${(parseFloat(raw) / 100).toFixed(2)}%` : raw;

  return {
    value: display,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      onChange(e.target.value.replace(/[^0-9.]/g, ""));
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      onChange(e.target.value.replace(/[^0-9.]/g, ""));
    },
  };
}

function usePercentField(value: string, onChange: (val: string) => void) {
  const [focused, setFocused] = useState(false);
  const raw = value.replace(/[^0-9.]/g, "");
  const display = !focused && raw !== "" ? `${raw}%` : raw;

  return {
    value: display,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      onChange(e.target.value.replace(/[^0-9.]/g, ""));
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      onChange(e.target.value.replace(/[^0-9.]/g, ""));
    },
  };
}

function useCurrencyField(value: string, onChange: (val: string) => void) {
  const [focused, setFocused] = useState(false);
  const display = !focused && value !== "" ? formatUSD(value) : value;

  return {
    value: display,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      onChange(stripFormat(e.target.value));
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      onChange(stripFormat(e.target.value));
    },
  };
}

export default function CurrentSpendForm({ meta, onChange }: Props) {
  const set = (key: keyof QuoteMeta) => (val: string) =>
    onChange({ ...meta, [key]: val });

  const monthly = useCurrencyField(
    meta.aeCurrentMonthlySpend ?? "",
    set("aeCurrentMonthlySpend"),
  );
  const voyix = useCurrencyField(
    meta.aeCurrentVoyixPaySpend ?? "",
    set("aeCurrentVoyixPaySpend"),
  );
  const headlineRate = usePercentField(
    meta.existingHeadlineRate ?? "",
    set("existingHeadlineRate"),
  );
  const interchangeRate = useBpsField(
    meta.existingInterchangeRate ?? "",
    set("existingInterchangeRate"),
  );

  const setRaw =
    (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...meta, [key]: e.target.value });

  return (
    <div className="quote-meta-form">
      <div className="meta-grid">
        <div className="field-group">
          <label>Aloha Essentials Current Monthly Spend</label>
          <input
            type="text"
            placeholder="Type $1 if New Customer"
            {...monthly}
          />
        </div>

        <div className="field-group">
          <label>Aloha Essentials Current Voyix Pay Spend</label>
          <input type="text" placeholder="Type $1 if New Customer" {...voyix} />
        </div>

        <div className="field-group">
          <label>Existing Headline Rate</label>
          <input type="text" placeholder="example 0.06" {...headlineRate} />
        </div>

        <div className="field-group">
          <label>Existing Interchange Rate</label>
          <input
            type="text"
            placeholder="Enter Whole Number"
            {...interchangeRate}
          />
        </div>
      </div>
    </div>
  );
}
