import React from "react";
import type { QuoteMeta } from "../types";

interface Props {
  meta: QuoteMeta;
  onChange: (meta: QuoteMeta) => void;
}

export default function QuoteMetaForm({ meta, onChange }: Props) {
  const set = (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ ...meta, [key]: e.target.value });
  };

  const setNum = (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChange({ ...meta, [key]: isNaN(val) ? 0 : Math.max(0, val) });
  };

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
            placeholder="contact@acme.com"
          />
        </div>

        <div className="field-group">
          <label>Valid Until</label>
          <input type="date" value={meta.validUntil} onChange={set("validUntil")} />
        </div>

        <div className="field-row">
          <div className="field-group">
            <label>Discount (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={meta.discount}
              onChange={setNum("discount")}
              onFocus={(e) => e.target.select()}
            />
          </div>
          <div className="field-group">
            <label>Tax (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={meta.tax}
              onChange={setNum("tax")}
              onFocus={(e) => e.target.select()}
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
