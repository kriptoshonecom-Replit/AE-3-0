import legacyData from "../data/legacy.json";
import { formatCurrency } from "../utils/calculations";

export interface LegacyItem {
  id: string;
  name: string;
  price?: number;
}

const legacyCat = (
  legacyData.categories as Array<{
    id: string;
    lineItems: LegacyItem[];
  }>
).find((c) => c.id === "aloha20");

const STATIC_LEGACY_ITEMS: LegacyItem[] = legacyCat ? legacyCat.lineItems : [];

interface Props {
  toggles: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
  quantities: Record<string, number>;
  onQuantityChange: (id: string, qty: number) => void;
  items?: LegacyItem[];
}

export function computeLegacyTotal(
  toggles: Record<string, boolean>,
  quantities: Record<string, number>,
  items: LegacyItem[] = STATIC_LEGACY_ITEMS,
): number {
  return items.reduce(
    (sum, item) =>
      sum + (toggles[item.id] && item.price ? item.price * (quantities[item.id] ?? 1) : 0),
    0,
  );
}

export default function LegacyHwSection({ toggles, onToggle, quantities, onQuantityChange, items }: Props) {
  const displayItems = items ?? STATIC_LEGACY_ITEMS;

  return (
    <div className="prpit-card">
      <div className="pit-yn-card" style={{ marginTop: 0 }}>
        {displayItems.map(({ id, name, price }) => {
          const on = toggles[id] ?? false;
          return (
            <div key={id} className="pit-yn-row">
              <span className="pit-yn-label">{name}</span>
              <span className="heatmap-item-price">
                {price !== undefined ? formatCurrency(price) : ""}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                className={`pit-toggle-switch ${on ? "pit-toggle-on" : "pit-toggle-off"}`}
                onClick={() => onToggle(id, !on)}
              >
                <span className="pit-toggle-thumb" />
              </button>
              <span
                className={`pit-yn-state ${on ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}
              >
                {on ? "Yes" : "No"}
              </span>
              {on && (
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantities[id] ?? 1}
                  onChange={(e) =>
                    onQuantityChange(id, Math.max(1, parseInt(e.target.value) || 1))
                  }
                  onFocus={(e) => e.target.select()}
                  className="qty-input"
                  style={{ marginLeft: "8px" }}
                />
              )}
            </div>
          );
        })}
        <div
          style={{
            padding: "10px 12px",
            fontSize: "12px",
            fontStyle: "italic",
            textAlign: "center",
            color: "var(--danger)",
            borderTop: "1px solid var(--border)",
          }}
        >
          These will not affect PIT in this calculator, but there will be a PIT component in Sales Force CPQ
        </div>
      </div>
    </div>
  );
}
