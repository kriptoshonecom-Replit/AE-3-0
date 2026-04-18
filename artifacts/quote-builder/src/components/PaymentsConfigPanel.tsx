import React from "react";
import type { QuoteMeta } from "../types";

interface Props {
  meta: QuoteMeta;
  onChange: (meta: QuoteMeta) => void;
}

export default function PaymentsConfigPanel({ meta, onChange }: Props) {
  const set = (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...meta, [key]: e.target.value });
  };

  const toggleBuyOut = () => {
    onChange({ ...meta, contractBuyOut: !meta.contractBuyOut });
  };

  const on = meta.contractBuyOut ?? false;

  return (
    <div className="quote-meta-form">
      <div className="meta-grid">

        {/* 1 — Annual Store Revenue */}
        <div className="field-group">
          <label>Annual Store Revenue</label>
          <div className="price-input-wrap">
            <span className="price-prefix">$</span>
            <input
              type="text"
              className="price-input"
              style={{ textAlign: "left", paddingLeft: "2px" }}
              value={meta.annualStoreRevenue ?? ""}
              onChange={set("annualStoreRevenue")}
              placeholder="Card Transaction Dollar Value"
            />
          </div>
        </div>

        {/* 2 — Average Ticket Amount */}
        <div className="field-group">
          <label>Average Ticket Amount</label>
          <div className="price-input-wrap">
            <span className="price-prefix">$</span>
            <input
              type="text"
              className="price-input"
              style={{ textAlign: "left", paddingLeft: "2px" }}
              value={meta.averageTicketAmount ?? ""}
              onChange={set("averageTicketAmount")}
              placeholder="Check Receipt Dollar Value"
            />
          </div>
        </div>

        {/* 3 — Contract BuyOut toggle */}
        <div className="field-group">
          <label>Contract BuyOut</label>
          <div className="payments-toggle-row">
            <button
              type="button"
              role="switch"
              aria-checked={on}
              className={`pit-toggle-switch ${on ? "pit-toggle-on" : "pit-toggle-off"}`}
              onClick={toggleBuyOut}
            >
              <span className="pit-toggle-thumb" />
            </button>
            <span className={`pit-yn-state ${on ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
              {on ? "Yes" : "No"}
            </span>
          </div>
        </div>

        {/* 4 — Cost of BuyOut */}
        <div className="field-group">
          <label>Cost of BuyOut</label>
          <div className="price-input-wrap">
            <span className="price-prefix">$</span>
            <input
              type="text"
              className="price-input"
              style={{ textAlign: "left", paddingLeft: "2px" }}
              value={meta.costOfBuyOut ?? ""}
              onChange={set("costOfBuyOut")}
              placeholder="Enter amount"
            />
          </div>
        </div>

        {/* 5 — Number of Sites */}
        <div className="field-group">
          <label>Number of Sites</label>
          <input
            type="number"
            min="1"
            step="1"
            value={meta.numberOfSites ?? ""}
            onChange={set("numberOfSites")}
            placeholder="Enter number of sites"
            onFocus={(e) => e.target.select()}
          />
        </div>

      </div>
    </div>
  );
}
