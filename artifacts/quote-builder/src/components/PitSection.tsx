import { useState } from "react";
import type { PitCategory } from "../types";
import pitData from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";

const pitCategories = pitData.categories as PitCategory[];

const OPTIONAL_PROGRAMS = [
  { id: "connected-payments", label: "Connected Payments" },
  { id: "online-ordering", label: "Online Ordering" },
  { id: "consumer-marketing", label: "Consumer Marketing" },
  { id: "insight-or-console", label: "Insight or Console" },
  { id: "aloha-api", label: "Aloha API" },
  { id: "kitchen", label: "Kitchen" },
  { id: "orderpay", label: "OrderPay" },
  { id: "aloha-delivery", label: "Aloha Delivery" },
];

interface Props {
  pitType: string;
  onChange: (pitType: string) => void;
}

export default function PitSection({ pitType, onChange }: Props) {
  const selected = pitCategories.find((c) => c.id === pitType) ?? null;

  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(OPTIONAL_PROGRAMS.map((p) => [p.id, false]))
  );

  const handleToggle = (id: string) => {
    setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const [yesNoToggles, setYesNoToggles] = useState<Record<string, boolean>>({
    "connected-payments-yn": false,
    "online-ordering-yn": false,
  });

  const handleYesNoToggle = (id: string) => {
    setYesNoToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="pit-card">
      <div className="pit-left">
        <div className="field-group">
          <label>PIT Type</label>
          <select
            className="pit-select"
            value={pitType}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— Select a PIT Type —</option>
            {pitCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="pit-rate-note">
          Rate: ${PIT_HOURLY_RATE.toFixed(2)} / hr
        </div>

        {pitType === "refresh" && (
          <div className="pit-optional-programs">
            <div className="pit-optional-title">Optional Programming</div>
            <div className="pit-toggles-list">
              {OPTIONAL_PROGRAMS.map((program) => (
                <div key={program.id} className="pit-toggle-row">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={toggles[program.id]}
                    className={`pit-toggle-switch ${toggles[program.id] ? "pit-toggle-on" : "pit-toggle-off"}`}
                    onClick={() => handleToggle(program.id)}
                  >
                    <span className="pit-toggle-thumb" />
                  </button>
                  <span className="pit-toggle-label">{program.label}</span>
                  <span className={`pit-toggle-state ${toggles[program.id] ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
                    {toggles[program.id] ? "On" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pit-right">
        {selected ? (
          <div className="pit-items">
            <div className="pit-items-header">
              <span className="pit-col-name">Core Line Items</span>
              <span className="pit-col-duration">Hrs</span>
              <span className="pit-col-price">Price</span>
            </div>
            <div className="pit-items-list">
              {selected.lineItems.map((item) => {
                const price = item.duration * PIT_HOURLY_RATE;
                return (
                  <div key={item.id} className="pit-item-row">
                    <span className="pit-item-name">{item.name}</span>
                    <span className="pit-item-duration">{item.duration} hr{item.duration !== 1 ? "s" : ""}</span>
                    <span className="pit-item-price">${price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="pit-items-total">
              <span className="pit-col-name">Total</span>
              <span className="pit-col-duration">
                {selected.lineItems.reduce((sum, item) => sum + item.duration, 0)} hrs
              </span>
              <span className="pit-col-price">
                ${selected.lineItems.reduce((sum, item) => sum + item.duration * PIT_HOURLY_RATE, 0).toFixed(2)}
              </span>
            </div>
            <div className="pit-yn-toggles">
              {[
                { id: "connected-payments-yn", label: "Connected Payments" },
                { id: "online-ordering-yn", label: "Online Ordering" },
              ].map(({ id, label }) => (
                <div key={id} className="pit-yn-row">
                  <span className="pit-yn-label">{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={yesNoToggles[id]}
                    className={`pit-toggle-switch ${yesNoToggles[id] ? "pit-toggle-on" : "pit-toggle-off"}`}
                    onClick={() => handleYesNoToggle(id)}
                  >
                    <span className="pit-toggle-thumb" />
                  </button>
                  <span className={`pit-yn-state ${yesNoToggles[id] ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
                    {yesNoToggles[id] ? "Yes" : "No"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pit-placeholder">
            Select a PIT Type to see its core line items.
          </div>
        )}
      </div>
    </div>
  );
}
