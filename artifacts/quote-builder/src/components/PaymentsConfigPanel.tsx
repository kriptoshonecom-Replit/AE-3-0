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

export default function PaymentsConfigPanel({ meta, onChange }: Props) {
  const set = (key: keyof QuoteMeta) => (val: string) =>
    onChange({ ...meta, [key]: val });

  const setRaw =
    (key: keyof QuoteMeta) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...meta, [key]: e.target.value });

  const costOfBuyOut = useCurrencyField(
    meta.costOfBuyOut ?? "",
    set("costOfBuyOut"),
  );
  const annualStoreRevenue = useCurrencyField(
    meta.annualStoreRevenue ?? "",
    set("annualStoreRevenue"),
  );
  const averageTicketAmount = useCurrencyField(
    meta.averageTicketAmount ?? "",
    set("averageTicketAmount"),
  );
  const requestedUpfrontAmount = useCurrencyField(
    meta.requestedUpfrontAmount ?? "",
    set("requestedUpfrontAmount"),
  );
  const requestedSubscriptionAmount = useCurrencyField(
    meta.requestedSubscriptionAmount ?? "",
    set("requestedSubscriptionAmount"),
  );
  const voyixPayFee = usePercentField(
    meta.voyixPayTransactionFee ?? "",
    set("voyixPayTransactionFee"),
  );
  const basisPoint = useBpsField(meta.basisPoint ?? "", set("basisPoint"));

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
            placeholder="Enter amount"
            disabled={!on}
            style={
              !on
                ? { opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" }
                : undefined
            }
            {...costOfBuyOut}
          />
        </div>

        {/* 3 — Annual Store Revenue */}
        <div className="field-group">
          <label>Annual Store Revenue</label>
          <input
            type="text"
            placeholder="Card Transaction Dollar Value"
            {...annualStoreRevenue}
          />
        </div>

        {/* 4 — Average Ticket Amount */}
        <div className="field-group">
          <label>Average Ticket Amount</label>
          <input
            type="text"
            placeholder="Check Receipt Dollar Value"
            {...averageTicketAmount}
          />
        </div>

        {/* 5 — Requested Upfront Amount */}
        <div className="field-group">
          <label>Requested Upfront Amount ( PIT Related )</label>
          <input
            type="text"
            placeholder="Aloha Essentials"
            {...requestedUpfrontAmount}
          />
        </div>

        {/* 6 — Requested Subscription Amount */}
        <div className="field-group">
          <label>Requested Subscription Amount</label>
          <input
            type="text"
            placeholder="Aloha Essentials"
            {...requestedSubscriptionAmount}
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
            onChange={setRaw("numberOfSites")}
            placeholder="Enter number of sites"
            onFocus={(e) => e.target.select()}
          />
        </div>

        {/* 8 — Voyix Pay Transaction Fee */}
        <div className="field-group">
          <label>Voyix Pay Transaction Fee</label>
          <input type="text" placeholder="example 0.06" {...voyixPayFee} />
        </div>

        {/* 9 — Basis Point */}
        <div className="field-group">
          <label>Basis Point</label>
          <input type="text" placeholder="Enter Whole Number" {...basisPoint} />
        </div>

        {/* 10 — Payments Specialist */}
        <div className="field-group">
          <label>Payments Specialist</label>
          <input
            type="text"
            value={meta.paymentsSpecialist ?? ""}
            onChange={setRaw("paymentsSpecialist")}
            placeholder="First Name Last"
          />
        </div>
      </div>
    </div>
  );
}
