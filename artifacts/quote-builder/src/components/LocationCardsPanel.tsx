import { useState } from "react";

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

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function passRate(p: GeoPoint) {
  return p.quoteCount ? Math.round((p.passCount / p.quoteCount) * 100) : 0;
}

export default function LocationCardsPanel({ byState, byCountry }: Props) {
  const [view, setView] = useState<"us" | "world">("us");

  const data = view === "us" ? byState : byCountry;
  const sorted = [...data].sort((a, b) => b.totalArr - a.totalArr);
  const maxArr = Math.max(...data.map((d) => d.totalArr), 1);

  return (
    <div className="db-card db-geo-card">

      <div className="db-card-header">
        <span className="db-card-title">Quote Distribution by Territory</span>
        <div className="geo-toggle">
          <button
            type="button"
            className={`geo-toggle-btn${view === "us" ? " active" : ""}`}
            onClick={() => setView("us")}
          >
            US States
          </button>
          <button
            type="button"
            className={`geo-toggle-btn${view === "world" ? " active" : ""}`}
            onClick={() => setView("world")}
          >
            World
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="geo-cards-empty">No quote data yet</div>
      ) : (
        <div className="geo-cards-grid">
          {sorted.map((p, i) => {
            const rate = passRate(p);
            const barW = Math.round((p.totalArr / maxArr) * 100);
            return (
              <div key={p.location} className="geo-region-card">
                <div className="geo-region-rank">#{i + 1}</div>
                <div className="geo-region-body">
                  <div className="geo-region-top">
                    <span className="geo-region-name">{p.location}</span>
                    <span className="geo-region-arr">{fmt(p.totalArr)}</span>
                  </div>
                  <div className="geo-region-bar-track">
                    <div className="geo-region-bar-fill" style={{ width: `${barW}%` }} />
                  </div>
                  <div className="geo-region-meta">
                    <span>{p.quoteCount} quote{p.quoteCount !== 1 ? "s" : ""}</span>
                    <span className={`geo-region-rate ${rate >= 50 ? "pass" : "fail"}`}>
                      {rate}% pass
                    </span>
                  </div>
                  <div className="geo-region-passfail">
                    <span style={{ color: "#15803d" }}>✓ {p.passCount}</span>
                    <span style={{ color: "#b91c1c" }}>✗ {p.failCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
