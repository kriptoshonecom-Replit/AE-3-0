import legacyData from "../data/legacy.json";
import { formatCurrency } from "../utils/calculations";

interface LegacyItem {
  id: string;
  name: string;
  price?: number;
  duration?: number;
}

const legacyCat = (
  legacyData.categories as Array<{
    id: string;
    lineItems: LegacyItem[];
  }>
).find((c) => c.id === "aloha20");

const LEGACY_ITEMS: LegacyItem[] = legacyCat ? legacyCat.lineItems : [];

interface Props {
  toggles: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
}

export function computeLegacyTotal(toggles: Record<string, boolean>): number {
  return LEGACY_ITEMS.reduce(
    (sum, item) => sum + (toggles[item.id] && item.price ? item.price : 0),
    0,
  );
}

export default function LegacyHwSection({ toggles, onToggle }: Props) {
  return (
    <div className="prpit-card">
      <div className="pit-yn-card" style={{ marginTop: 0 }}>
        {LEGACY_ITEMS.map(({ id, name, price, duration }) => {
          const on = toggles[id] ?? false;
          return (
            <div key={id} className="pit-yn-row">
              <span className="pit-yn-label">{name}</span>
              <span className="heatmap-item-price">
                {price !== undefined
                  ? formatCurrency(price)
                  : duration !== undefined
                  ? `${duration} hrs`
                  : ""}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
