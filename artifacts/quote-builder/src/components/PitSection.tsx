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
  optionalProgramToggles: Record<string, boolean>;
  onOptionalProgramToggle: (id: string) => void;
}

export default function PitSection({ pitType, onChange, optionalProgramToggles, onOptionalProgramToggle }: Props) {
  const selected = pitCategories.find((c) => c.id === pitType) ?? null;

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
                    aria-checked={optionalProgramToggles[program.id] ?? true}
                    className={`pit-toggle-switch ${(optionalProgramToggles[program.id] ?? true) ? "pit-toggle-on" : "pit-toggle-off"}`}
                    onClick={() => onOptionalProgramToggle(program.id)}
                  >
                    <span className="pit-toggle-thumb" />
                  </button>
                  <span className="pit-toggle-label">{program.label}</span>
                  <span className={`pit-toggle-state ${(optionalProgramToggles[program.id] ?? true) ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
                    {(optionalProgramToggles[program.id] ?? true) ? "On" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pit-right">
        <div className="pit-right-inner">
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
            </div>
          ) : (
            <div className="pit-placeholder">
              Select a PIT Type to see its core line items.
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
