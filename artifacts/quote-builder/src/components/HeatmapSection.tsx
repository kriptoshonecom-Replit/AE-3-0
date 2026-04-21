import pitServicesData from "../data/pit-services.json";
import { formatCurrency } from "../utils/calculations";

export interface HeatmapItem {
  id: string;
  name: string;
  price: number;
}

const heatmapCat = (
  pitServicesData.categories as Array<{
    id: string;
    lineItems: Array<{ id: string; name: string; price?: number; duration?: number }>;
  }>
).find((c) => c.id === "heatmap");

const STATIC_HEATMAP_ITEMS: HeatmapItem[] = heatmapCat
  ? (heatmapCat.lineItems.filter((i) => i.price !== undefined) as HeatmapItem[])
  : [];

interface Props {
  toggles: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
  items?: HeatmapItem[];
}

export function computeHeatmapTotal(
  toggles: Record<string, boolean>,
  items: HeatmapItem[] = STATIC_HEATMAP_ITEMS,
): number {
  return items.reduce(
    (sum, item) => sum + (toggles[item.id] ? item.price : 0),
    0,
  );
}

export default function HeatmapSection({ toggles, onToggle, items }: Props) {
  const displayItems = items ?? STATIC_HEATMAP_ITEMS;

  return (
    <div className="prpit-card">
      <div className="pit-yn-card" style={{ marginTop: 0 }}>
        {displayItems.map(({ id, name, price }) => {
          const on = toggles[id] ?? false;
          return (
            <div key={id} className="pit-yn-row">
              <span className="pit-yn-label">{name}</span>
              <span className="heatmap-item-price">
                {formatCurrency(price)}
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
          These products are highly recommended for devices communicating over a
          Wi-Fi network (e.g., Windows tablets, handhelds, and mobile PIN pads).
        </div>
      </div>
    </div>
  );
}
