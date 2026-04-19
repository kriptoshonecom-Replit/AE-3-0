import React from "react";
import type { QuoteMeta } from "../types";

interface Props {
  meta: QuoteMeta;
  onChange: (meta: QuoteMeta) => void;
}

export default function PaymentsConfigPanel({ meta, onChange }: Props) {
  const set =
    (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...meta, [key]: e.target.value });
    };

  const toggleBuyOut = () => {
    onChange({ ...meta, contractBuyOut: !meta.contractBuyOut });
  };

  const on = meta.contractBuyOut ?? false;

  return (
    <div className="quote-meta-form">
      <div className="meta-grid">
        {/* 1 — Contract BuyOut toggle */}
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
            <span
              className={`pit-yn-state ${on ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}
            >
              {on ? "Yes" : "No"}
            </span>
          </div>
        </div>

        {/* 2 — Cost of BuyOut */}
        <div className="field-group">
          <label>Cost of BuyOut</label>
          <input
            type="text"
            value={meta.costOfBuyOut ?? ""}
            onChange={set("costOfBuyOut")}
            placeholder="Enter amount"
          />
        </div>

        {/* 3 — Annual Store Revenue */}
        <div className="field-group">
          <label>Annual Store Revenue</label>
          <input
            type="text"
            value={meta.annualStoreRevenue ?? ""}
            onChange={set("annualStoreRevenue")}
            placeholder="Card Transaction $ Value"
          />
        </div>

        {/* 4 — Average Ticket Amount */}
        <div className="field-group">
          <label>Average Ticket Amount</label>
          <input
            type="text"
            value={meta.averageTicketAmount ?? ""}
            onChange={set("averageTicketAmount")}
            placeholder="Check Receipt $ Value"
          />
        </div>

        {/* 5 — Requested Upfront Amount */}
        <div className="field-group">
          <label>Requested Upfront Cost</label>
          <input
            type="text"
            value={meta.requestedUpfrontAmount ?? ""}
            onChange={set("requestedUpfrontAmount")}
            placeholder="Aloha Essentials"
          />
        </div>

        {/* 6 — Requested Subscription Amount */}
        <div className="field-group">
          <label>Requested Subscription Amount</label>
          <input
            type="text"
            value={meta.requestedSubscriptionAmount ?? ""}
            onChange={set("requestedSubscriptionAmount")}
            placeholder="Aloha Essentials"
          />
        </div>

        {/* 7 — Number of Sites */}
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

        {/* 8 — Voyix Pay Transaction Fee */}
        <div className="field-group">
          <label>Voyix Pay Transaction Fee</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={meta.voyixPayTransactionFee ?? ""}
            onChange={set("voyixPayTransactionFee")}
            placeholder="example 0.06"
            onFocus={(e) => e.target.select()}
          />
        </div>

        {/* 9 — Basis Point */}
        <div className="field-group">
          <label>Basis Point</label>
          <input
            type="number"
            min="0"
            step="1"
            value={meta.basisPoint ?? ""}
            onChange={set("basisPoint")}
            placeholder="Enter Whole Number"
            onFocus={(e) => e.target.select()}
          />
        </div>

        {/* 10 — Payments Specialist */}
        <div className="field-group">
          <label>Payments Specialist</label>
          <input
            type="text"
            value={meta.paymentsSpecialist ?? ""}
            onChange={set("paymentsSpecialist")}
            placeholder="First Name Last"
          />
        </div>
      </div>
    </div>
  );
}
