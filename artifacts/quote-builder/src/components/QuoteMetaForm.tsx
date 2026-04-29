import React, { useState } from "react";
import type { QuoteMeta } from "../types";

interface Props {
  meta: QuoteMeta;
  onChange: (meta: QuoteMeta) => void;
  pspmDiscountPct?: number;
  upfrontPriceDiscountPct?: number;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function QuoteMetaForm({ meta, onChange, pspmDiscountPct, upfrontPriceDiscountPct }: Props) {
  const [emailTouched, setEmailTouched] = useState(false);

  const set = (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ ...meta, [key]: e.target.value });
  };

  const emailError =
    emailTouched && meta.customerEmail && !isValidEmail(meta.customerEmail)
      ? "Please enter a valid email address"
      : null;

  const fmtPct = (v?: number) =>
    v === undefined || isNaN(v) ? "—" : `${v.toFixed(2)}%`;

  return (
    <div className="quote-meta-form">
      <div className="meta-grid">
        <div className="field-group">
          <label>Quote Number</label>
          <input
            type="text"
            value={meta.quoteNumber}
            onChange={set("quoteNumber")}
            placeholder="Q-12345"
          />
        </div>

        <div className="field-group">
          <label>Opp Number</label>
          <input
            type="text"
            value={meta.oppNumber}
            onChange={set("oppNumber")}
            placeholder="1234457"
          />
        </div>

        <div className="field-group">
          <label>Sales Rep</label>
          <input
            type="text"
            value={meta.salesRep}
            onChange={set("salesRep")}
            placeholder="e.g. Jane Smith"
          />
        </div>

        <div className="field-group">
          <label>Company Name</label>
          <input
            type="text"
            value={meta.companyName}
            onChange={set("companyName")}
            placeholder="Acme Corp"
          />
        </div>

        <div className="field-group">
          <label>Customer Name</label>
          <input
            type="text"
            value={meta.customerName}
            onChange={set("customerName")}
            placeholder="John Smith"
          />
        </div>

        <div className="field-group">
          <label>Customer Email</label>
          <input
            type="email"
            value={meta.customerEmail}
            onChange={set("customerEmail")}
            onBlur={() => setEmailTouched(true)}
            placeholder="contact@acme.com"
            className={emailError ? "input-error" : undefined}
          />
          {emailError && <span className="field-error">{emailError}</span>}
        </div>

        <div className="field-group">
          <label>Valid Until</label>
          <input type="date" value={meta.validUntil} onChange={set("validUntil")} />
        </div>

        <div className="field-row">
          <div className="field-group">
            <label>PSPM Discount %</label>
            <input
              type="text"
              readOnly
              value={fmtPct(pspmDiscountPct)}
              className="input-readonly-computed"
            />
          </div>
          <div className="field-group">
            <label>Upfront Price Discount %</label>
            <input
              type="text"
              readOnly
              value={fmtPct(upfrontPriceDiscountPct)}
              className="input-readonly-computed"
            />
          </div>
        </div>

        <div className="field-group span-2">
          <label>Notes</label>
          <textarea
            value={meta.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Payment terms, delivery notes, special conditions…"
          />
        </div>
      </div>
    </div>
  );
}
