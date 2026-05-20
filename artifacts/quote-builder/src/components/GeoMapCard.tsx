import { useState, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const US_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const WORLD_GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const STATE_ABBR: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

export interface GeoPoint {
  location: string;
  quoteCount: number;
  totalArr: number;
  passCount: number;
  failCount: number;
}

interface Props {
  byState: GeoPoint[];
  byCountry: GeoPoint[];
}

interface TooltipState {
  x: number;
  y: number;
  name: string;
  point: GeoPoint;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "#f5f3ff";
  const t = Math.min(value / max, 1);
  const r = Math.round(237 + (124 - 237) * t);
  const g = Math.round(233 + (58 - 233) * t);
  const b = Math.round(254 + (237 - 254) * t);
  return `rgb(${r},${g},${b})`;
}

function getHoverColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "#ddd6fe";
  return getColor(Math.min(value * 1.35, max), max);
}

function passRate(p: GeoPoint) {
  return p.quoteCount ? Math.round((p.passCount / p.quoteCount) * 100) : 0;
}

export default function GeoMapCard({ byState, byCountry }: Props) {
  const [view, setView] = useState<"us" | "world">("us");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const data = view === "us" ? byState : byCountry;

  const lookup = new Map<string, GeoPoint>();
  for (const p of data) {
    const key = p.location.trim().toLowerCase();
    lookup.set(key, p);
    const expanded = STATE_ABBR[p.location.trim().toUpperCase()];
    if (expanded) lookup.set(expanded.toLowerCase(), p);
  }

  const sorted = [...data].sort((a, b) => b.totalArr - a.totalArr);
  const maxArr = Math.max(...data.map((d) => d.totalArr), 1);
  const getPoint = (name: string) => lookup.get(name.toLowerCase());

  const handleGeoMouseEnter = (name: string) =>
    (evt: React.MouseEvent<SVGPathElement>) => {
      if (!mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const point = getPoint(name) ?? {
        location: name, quoteCount: 0, totalArr: 0, passCount: 0, failCount: 0,
      };
      setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, name, point });
      setHighlighted(name.toLowerCase());
    };

  const handleGeoMouseMove = (evt: React.MouseEvent<SVGPathElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    setTooltip((prev) =>
      prev ? { ...prev, x: evt.clientX - rect.left, y: evt.clientY - rect.top } : null
    );
  };

  const handleGeoMouseLeave = () => {
    setTooltip(null);
    setHighlighted(null);
  };

  const geoUrl = view === "us" ? US_GEO_URL : WORLD_GEO_URL;

  const projectionConfig = view === "us"
    ? undefined
    : { scale: 120, center: [0, 20] as [number, number] };

  return (
    <div className="db-card db-geo-card">
      {/* Header */}
      <div className="db-card-header">
        <span className="db-card-title">Quote Distribution by Territory</span>
        <div className="geo-toggle">
          <button
            type="button"
            className={`geo-toggle-btn${view === "us" ? " active" : ""}`}
            onClick={() => { setView("us"); setTooltip(null); setHighlighted(null); }}
          >
            US States
          </button>
          <button
            type="button"
            className={`geo-toggle-btn${view === "world" ? " active" : ""}`}
            onClick={() => { setView("world"); setTooltip(null); setHighlighted(null); }}
          >
            World
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="geo-body">

        {/* LEFT — draggable map */}
        <div className="geo-map-col" ref={mapRef}>
          <div className="geo-drag-hint">Drag to pan · scroll to zoom</div>
          <div className="geo-map-frame">
            <ComposableMap
              projection={view === "us" ? "geoAlbersUsa" : "geoMercator"}
              projectionConfig={projectionConfig}
              width={760}
              height={view === "us" ? 440 : 420}
              style={{ width: "100%", height: "100%", display: "block" }}
            >
              <ZoomableGroup zoom={1}>
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const name = String(geo.properties.name ?? "");
                      const point = getPoint(name);
                      const isHighlighted = highlighted === name.toLowerCase();
                      const fill = isHighlighted
                        ? "#a855f7"
                        : point
                          ? getColor(point.totalArr, maxArr)
                          : "#f1f5f9";
                      const hoverFill = point
                        ? getHoverColor(point.totalArr, maxArr)
                        : "#e2e8f0";
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke="#fff"
                          strokeWidth={0.6}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none", fill: hoverFill, cursor: "grab" },
                            pressed: { outline: "none", cursor: "grabbing" },
                          }}
                          onMouseEnter={handleGeoMouseEnter(name)}
                          onMouseMove={handleGeoMouseMove}
                          onMouseLeave={handleGeoMouseLeave}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>

            {/* Tooltip inside map frame */}
            {tooltip && (
              <div
                className="geo-tooltip"
                style={{
                  left: Math.min(tooltip.x + 12, (mapRef.current?.offsetWidth ?? 400) - 168),
                  top: Math.max(tooltip.y - 10, 4),
                }}
              >
                <div className="geo-tooltip-name">{tooltip.name}</div>
                {tooltip.point.quoteCount > 0 ? (
                  <>
                    <div className="geo-tooltip-row">
                      <span>Quotes</span>
                      <strong>{tooltip.point.quoteCount}</strong>
                    </div>
                    <div className="geo-tooltip-row">
                      <span>ARR</span>
                      <strong>{fmt(tooltip.point.totalArr)}</strong>
                    </div>
                    <div className="geo-tooltip-row">
                      <span>Pass rate</span>
                      <strong>{passRate(tooltip.point)}%</strong>
                    </div>
                    <div className="geo-tooltip-row">
                      <span>Pass / Fail</span>
                      <strong>
                        <span style={{ color: "#15803d" }}>{tooltip.point.passCount}</span>
                        {" / "}
                        <span style={{ color: "#b91c1c" }}>{tooltip.point.failCount}</span>
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="geo-tooltip-empty">No quotes yet</div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT — region cards */}
        <div className="geo-cards-col">
          {/* Legend lives here */}
          <div className="geo-legend">
            <span className="geo-legend-label">Low ARR</span>
            <div className="geo-legend-bar" />
            <span className="geo-legend-label">High ARR</span>
          </div>
          <div className="geo-cards-heading">
            {sorted.length === 0 ? (view === "us" ? "States" : "Countries") : `${sorted.length} ${view === "us" ? "State" : "Countr"}${sorted.length === 1 ? (view === "us" ? "" : "y") : (view === "us" ? "s" : "ies")} with quotes`}
          </div>
          <div className="geo-cards-list">
            {sorted.length === 0 ? (
              <div className="geo-cards-empty">No quote data yet</div>
            ) : (
              sorted.map((p, i) => {
                const rate = passRate(p);
                const barW = Math.round((p.totalArr / maxArr) * 100);
                return (
                  <div
                    key={p.location}
                    className={`geo-region-card${highlighted === p.location.toLowerCase() ? " hovered" : ""}`}
                    onMouseEnter={() => setHighlighted(p.location.toLowerCase())}
                    onMouseLeave={() => setHighlighted(null)}
                  >
                    <div className="geo-region-rank">#{i + 1}</div>
                    <div className="geo-region-body">
                      <div className="geo-region-top">
                        <span className="geo-region-name">{p.location}</span>
                        <span className="geo-region-arr">{fmt(p.totalArr)}</span>
                      </div>
                      <div className="geo-region-bar-track">
                        <div
                          className="geo-region-bar-fill"
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                      <div className="geo-region-meta">
                        <span>{p.quoteCount} quote{p.quoteCount !== 1 ? "s" : ""}</span>
                        <span
                          className={`geo-region-rate ${rate >= 50 ? "pass" : "fail"}`}
                        >
                          {rate}% pass
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
