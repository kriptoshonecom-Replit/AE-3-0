import pitServicesData from "../data/pit-services.json";
import { formatCurrency } from "../utils/calculations";

interface HeatmapItem {
  id: string;
  name: string;
  price: number;
}

const heatmapCat = (pitServicesData.categories as Array<{ id: string; lineItems: Array<{ id: string; name: string; price?: number; duration?: number }> }>)
  .find((c) => c.id === "heatmap");

const HEATMAP_ITEMS: HeatmapItem[] = heatmapCat
  ? (heatmapCat.lineItems as HeatmapItem[])
  : [];

interface Props {
  toggles: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
}

export function computeHeatmapTotal(toggles: Record<string, boolean>): number {
  return HEATMAP_ITEMS.reduce((sum, item) => sum + (toggles[item.id] ? item.price : 0), 0);
}

export default function HeatmapSection({ toggles, onToggle }: Props) {
  return (
    <div className="prpit-card">
      <div className="pit-yn-card" style={{ marginTop: 0 }}>
        {HEATMAP_ITEMS.map(({ id, name, price }) => {
          const on = toggles[id] ?? false;
          return (
            <div key={id} className="pit-yn-row">
              <span className="pit-yn-label">{name}</span>
              <span className="heatmap-item-price">{formatCurrency(price)}</span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                className={`pit-toggle-switch ${on ? "pit-toggle-on" : "pit-toggle-off"}`}
                onClick={() => onToggle(id, !on)}
              >
                <span className="pit-toggle-thumb" />
              </button>
              <span className={`pit-yn-state ${on ? "pit-toggle-state-on" : "pit-toggle-state-off"}`}>
                {on ? "Yes" : "No"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
