import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LMap, LayerGroup, Marker } from "leaflet";

interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface POI {
  id: number;
  lat: number;
  lon: number;
  name: string;
  category: CategoryId;
  tags: Record<string, string>;
}

type CategoryId = "restaurant" | "bar" | "nightclub" | "bakery" | "pastry";

interface Category {
  id: CategoryId;
  label: string;
  color: string;
  icon: string;
  overpassTag: string;
}

const CATEGORIES: Category[] = [
  {
    id: "restaurant",
    label: "Restaurants",
    color: "#f97316",
    icon: "🍽",
    overpassTag: 'node["amenity"="restaurant"]',
  },
  {
    id: "bar",
    label: "Bars",
    color: "#3b82f6",
    icon: "🍺",
    overpassTag: 'node["amenity"="bar"]',
  },
  {
    id: "nightclub",
    label: "Night Clubs",
    color: "#8b5cf6",
    icon: "🎵",
    overpassTag: 'node["amenity"="nightclub"]',
  },
  {
    id: "bakery",
    label: "Bakeries",
    color: "#b45309",
    icon: "🍞",
    overpassTag: 'node["shop"="bakery"]',
  },
  {
    id: "pastry",
    label: "Pastry",
    color: "#ec4899",
    icon: "🥐",
    overpassTag: 'node["shop"="pastry"]',
  },
];

function catById(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id)!;
}

function formatPhone(phone: string | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/\s+/g, " ").trim();
}

function formatAddress(tags: Record<string, string>): string | null {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

const MIN_ZOOM = 12;

export default function BusinessMarketPage() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const markerMapRef = useRef<Map<number, Marker>>(new Map());

  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(
    new Set(["restaurant", "bar", "nightclub", "bakery", "pastry"]),
  );
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoomWarning, setZoomWarning] = useState(false);
  const [searchPending, setSearchPending] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const fetchPOI = useCallback(
    async (map: LMap, cats: Set<CategoryId>) => {
      const zoom = map.getZoom();
      if (zoom < MIN_ZOOM) {
        setZoomWarning(true);
        return;
      }
      setZoomWarning(false);
      setSearchPending(false);
      setLoading(true);
      setCount(null);

      const bounds = map.getBounds();
      const s = bounds.getSouth().toFixed(6);
      const w = bounds.getWest().toFixed(6);
      const n = bounds.getNorth().toFixed(6);
      const e = bounds.getEast().toFixed(6);
      const bbox = `(${s},${w},${n},${e})`;

      const activeCats = CATEGORIES.filter((c) => cats.has(c.id));
      if (!activeCats.length) {
        layerRef.current?.clearLayers();
        markerMapRef.current.clear();
        setLoading(false);
        return;
      }

      const query = `[out:json][timeout:25];(${activeCats.map((c) => `${c.overpassTag}${bbox};`).join("")});out body;`;

      try {
        const resp = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: query,
        });
        const data = (await resp.json()) as { elements: OverpassNode[] };

        layerRef.current?.clearLayers();
        markerMapRef.current.clear();

        const L = (await import("leaflet")).default;

        const pois: POI[] = data.elements
          .filter((el) => el.tags?.name)
          .map((el) => {
            let category: CategoryId = "restaurant";
            if (el.tags.amenity === "bar") category = "bar";
            else if (el.tags.amenity === "nightclub") category = "nightclub";
            else if (el.tags.shop === "bakery") category = "bakery";
            else if (el.tags.shop === "pastry") category = "pastry";
            return { id: el.id, lat: el.lat, lon: el.lon, name: el.tags.name, category, tags: el.tags };
          });

        setCount(pois.length);

        pois.forEach((poi) => {
          const cat = catById(poi.category);
          const icon = L.divIcon({
            className: "",
            html: `<div class="bm-marker-dot" style="background:${cat.color}"><span>${cat.icon}</span></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          const marker = L.marker([poi.lat, poi.lon], { icon }).addTo(layerRef.current!);
          marker.on("click", () => setSelectedPoi(poi));
          markerMapRef.current.set(poi.id, marker);
        });
      } catch {
        /* silently skip on network error */
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    let cancelled = false;

    void import("leaflet").then(async (mod) => {
      if (cancelled || !mapDivRef.current) return;
      const L = mod.default;

      await import("leaflet/dist/leaflet.css");

      const map = L.map(mapDivRef.current, {
        center: [40.7128, -74.006],
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;
      mapRef.current = map;

      map.on("moveend", () => setSearchPending(true));

      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            map.setView([pos.coords.latitude, pos.coords.longitude], 14);
            void fetchPOI(map, new Set(["restaurant", "bar", "nightclub", "bakery", "pastry"]));
          },
          () => {
            if (cancelled) return;
            void fetchPOI(map, new Set(["restaurant", "bar", "nightclub", "bakery", "pastry"]));
          },
        );
      } catch {
        void fetchPOI(map, new Set(["restaurant", "bar", "nightclub", "bakery", "pastry"]));
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      markerMapRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCategory(id: CategoryId) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      setSearchPending(true);
      return next;
    });
  }

  function handleSearch() {
    if (mapRef.current) void fetchPOI(mapRef.current, activeCategories);
  }

  const poi = selectedPoi;
  const poiCat = poi ? catById(poi.category) : null;
  const phone = poi ? formatPhone(poi.tags.phone ?? poi.tags["contact:phone"]) : null;
  const address = poi ? formatAddress(poi.tags) : null;
  const website = poi ? (poi.tags.website ?? poi.tags["contact:website"] ?? null) : null;
  const hours = poi ? (poi.tags.opening_hours ?? null) : null;
  const osmUrl = poi ? `https://www.openstreetmap.org/node/${poi.id}` : null;

  return (
    <div className="bm-page">
      <div ref={mapDivRef} className="bm-map" />

      <div className="bm-top-bar">
        <div className="bm-filters">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`bm-filter-chip${activeCategories.has(cat.id) ? " active" : ""}`}
              style={activeCategories.has(cat.id) ? { "--chip-color": cat.color } as React.CSSProperties : undefined}
              onClick={() => toggleCategory(cat.id)}
            >
              <span className="bm-chip-icon">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        <div className="bm-search-area">
          {zoomWarning && (
            <span className="bm-zoom-warning">Zoom in to search</span>
          )}
          {searchPending && !zoomWarning && (
            <button type="button" className="bm-search-btn" onClick={handleSearch}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Search this area
            </button>
          )}
          {loading && (
            <div className="bm-loading-pill">
              <span className="spinner" style={{ width: 12, height: 12 }} />
              Searching…
            </div>
          )}
          {!loading && count !== null && !searchPending && (
            <div className="bm-count-pill">{count} place{count !== 1 ? "s" : ""} found</div>
          )}
        </div>
      </div>

      <div className={`bm-panel${poi ? " open" : ""}`}>
        {poi && poiCat && (
          <>
            <div className="bm-panel-header" style={{ borderLeftColor: poiCat.color }}>
              <div>
                <div className="bm-panel-cat-badge" style={{ background: poiCat.color }}>
                  {poiCat.icon} {poiCat.label.replace(/s$/, "")}
                </div>
                <h2 className="bm-panel-name">{poi.name}</h2>
              </div>
              <button
                type="button"
                className="bm-panel-close"
                onClick={() => setSelectedPoi(null)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="bm-panel-body">
              {address && (
                <div className="bm-detail-row">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                  <span>{address}</span>
                </div>
              )}

              {phone && (
                <div className="bm-detail-row">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 2h3l1.5 3.5-1.5 1a9 9 0 004 4l1-1.5L14.5 10.5V14a1 1 0 01-1 1C5.5 15 1 10.5 1 3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <a href={`tel:${phone}`} className="bm-link">{phone}</a>
                </div>
              )}

              {website && (
                <div className="bm-detail-row">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M8 2c-1.5 2-2.5 3.5-2.5 6s1 4 2.5 6M8 2c1.5 2 2.5 3.5 2.5 6S9.5 14 8 14M2 8h12" stroke="currentColor" strokeWidth="1.1" />
                  </svg>
                  <a href={website} target="_blank" rel="noopener noreferrer" className="bm-link bm-link-ext">
                    {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </a>
                </div>
              )}

              {hours && (
                <div className="bm-detail-row bm-detail-row--top">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="bm-hours">{hours}</span>
                </div>
              )}

              {poi.tags.cuisine && (
                <div className="bm-detail-row">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M5 2v5c0 1.7 1.3 3 3 3s3-1.3 3-3V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M8 10v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <span style={{ textTransform: "capitalize" }}>{poi.tags.cuisine.replace(/_/g, " ")}</span>
                </div>
              )}

              {poi.tags.outdoor_seating === "yes" && (
                <div className="bm-tag-row">
                  <span className="bm-feature-tag">🌿 Outdoor Seating</span>
                </div>
              )}
              {poi.tags.wheelchair === "yes" && (
                <div className="bm-tag-row">
                  <span className="bm-feature-tag">♿ Accessible</span>
                </div>
              )}
              {poi.tags["diet:vegetarian"] === "yes" && (
                <div className="bm-tag-row">
                  <span className="bm-feature-tag">🥗 Vegetarian</span>
                </div>
              )}
              {poi.tags["diet:vegan"] === "yes" && (
                <div className="bm-tag-row">
                  <span className="bm-feature-tag">🌱 Vegan</span>
                </div>
              )}

              {!address && !phone && !website && !hours && !poi.tags.cuisine && (
                <p className="bm-no-details">No additional details available in OpenStreetMap for this location.</p>
              )}
            </div>

            <div className="bm-panel-footer">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bm-osm-link"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8 2c-1.5 2-2.5 3.5-2.5 6s1 4 2.5 6M8 2c1.5 2 2.5 3.5 2.5 6S9.5 14 8 14M2 8h12" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                Open in Google Maps
              </a>
              <a
                href={osmUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="bm-osm-link bm-osm-link--secondary"
              >
                View on OpenStreetMap
              </a>
            </div>
          </>
        )}
      </div>

      {poi && (
        <div className="bm-panel-backdrop" onClick={() => setSelectedPoi(null)} />
      )}
    </div>
  );
}
