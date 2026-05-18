import pitDataStatic from "../data/pit-services.json";
import { PIT_HOURLY_RATE as STATIC_PIT_HOURLY_RATE } from "../data/pit-config";
import type { PitCategory, QuoteGroup } from "../types";
import type { ProductCatalogMap } from "./ProductRelatedPitSection";

const STATIC_PIT_CATEGORIES = (pitDataStatic.categories as unknown as PitCategory[]).filter(
  (c) => c.id !== "heatmap",
);

// Derive optional-program toggle items directly from products in the quote
// that carry non-zero pro or train durations. Keys are product IDs so the
// list automatically expands when new products are added to the catalog.
function deriveOptionalPrograms(
  groups: QuoteGroup[],
  catalogMap: ProductCatalogMap,
): Array<{ id: string; label: string }> {
  const seen = new Set<string>();
  const items: Array<{ id: string; label: string }> = [];
  for (const group of groups) {
    for (const li of group.lineItems) {
      if (li.quantity <= 0 || seen.has(li.productId)) continue;
      const entry = catalogMap.get(li.productId);
      if (entry && (entry.produration > 0 || entry.traduration > 0)) {
        seen.add(li.productId);
        items.push({ id: li.productId, label: li.productName });
      }
    }
  }
  return items;
}

interface Props {
  pitType: string;
  onChange: (pitType: string) => void;
  recurringPit: boolean;
  onRecurringPitChange: (val: boolean) => void;
  yesNoToggles: Record<string, boolean>;
  onYesNoChange: (id: string, value: boolean) => void;
  optionalProgramToggles: Record<string, boolean>;
  onOptionalProgramToggle: (id: string) => void;
  pitCategories?: PitCategory[];
  pitHourlyRate?: number;
  // New: needed for dynamic optional-program list
  groups?: QuoteGroup[];
  catalogMap?: ProductCatalogMap;
}

export default function PitSection({
  pitType,
  onChange,
  recurringPit,
  onRecurringPitChange,
  yesNoToggles,
  onYesNoChange,
  optionalProgramToggles,
  onOptionalProgramToggle,
  pitCategories,
  pitHourlyRate,
  groups = [],
  catalogMap,
}: Props) {
  const PIT_HOURLY_RATE = pitHourlyRate ?? STATIC_PIT_HOURLY_RATE;
  const categories = (pitCategories ?? STATIC_PIT_CATEGORIES).filter(
    (c) => c.id !== "heatmap",
  );
  const selected = categories.find((c) => c.id === pitType) ?? null;

  // Only compute when we're on the refresh type and have catalog data
  const optionalPrograms =
    pitType === "refresh" && catalogMap
      ? deriveOptionalPrograms(groups, catalogMap)
      : [];

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
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="pit-yn-row pit-recurring-row">
          <span className="pit-yn-label">Recurring PIT</span>
          <button
            type="button"
            role="switch"
            aria-checked={recurringPit}
            className={`pit-toggle-switch ${recurringPit ? "pit-toggle-on" : "pit-toggle-off"}`}
            onClick={() => onRecurringPitChange(!recurringPit)}
          >
            <span className="pit-toggle-thumb" />
          </button>
          <span className={`pit-yn-state ${recurringPit ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
            {recurringPit ? "Yes" : "No"}
          </span>
        </div>

        <div className="pit-rate-note">
          Rate: ${PIT_HOURLY_RATE.toFixed(2)} / hr
        </div>

        {pitType === "refresh" && (
          <div className="pit-optional-programs">
            <div className="pit-optional-title">Optional Programming</div>
            {optionalPrograms.length === 0 ? (
              <p className="pit-optional-empty">
                Add products with Pro or Train durations to enable optional programming toggles.
              </p>
            ) : (
              <div className="pit-toggles-list">
                {optionalPrograms.map((program) => {
                  const isOn = optionalProgramToggles[program.id] ?? true;
                  return (
                    <div key={program.id} className="pit-toggle-row">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        className={`pit-toggle-switch ${isOn ? "pit-toggle-on" : "pit-toggle-off"}`}
                        onClick={() => onOptionalProgramToggle(program.id)}
                      >
                        <span className="pit-toggle-thumb" />
                      </button>
                      <span className="pit-toggle-label">{program.label}</span>
                      <span className={`pit-toggle-state ${isOn ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
                        {isOn ? "On" : "Off"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
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

          <div className="pit-yn-card">
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
                  onClick={() => onYesNoChange(id, !yesNoToggles[id])}
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
      </div>
    </div>
  );
}
