import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";

interface AddressFields {
  addressName: string;
  addressNumber: string;
  zipCode: string;
  addressCountry: string;
}

interface Props {
  values: AddressFields;
  onChange: (fields: Partial<AddressFields>) => void;
}

const COUNTRIES = [
  "United States", "Canada", "Mexico", "United Kingdom", "Australia",
  "Germany", "France", "Spain", "Italy", "Netherlands", "Belgium",
  "Switzerland", "Austria", "Portugal", "Denmark", "Sweden", "Norway",
  "Finland", "Ireland", "New Zealand", "Japan", "South Korea", "Singapore",
  "Hong Kong", "India", "Brazil", "Argentina", "Chile", "Colombia",
  "South Africa", "UAE", "Saudi Arabia", "Israel", "Turkey", "Poland",
  "Czech Republic", "Hungary", "Romania", "Greece", "Croatia",
];

const POI_CATEGORIES = [
  { key: "restaurant", label: "Restaurant", color: "#ef4444", filter: `node["amenity"="restaurant"]` },
  { key: "bar",        label: "Bar",        color: "#f97316", filter: `node["amenity"="bar"]` },
  { key: "nightclub",  label: "Nightclub",  color: "#8b5cf6", filter: `node["amenity"="nightclub"]` },
  { key: "retail",     label: "Retail",     color: "#0ea5e9", filter: `node["shop"]` },
] as const;

type PoiKey = (typeof POI_CATEGORIES)[number]["key"];

function buildQuery(f: AddressFields): string {
  return [f.addressNumber, f.addressName, f.zipCode, f.addressCountry]
    .filter(Boolean)
    .join(", ");
}

interface OverpassNode {
  lat: number;
  lon: number;
  tags?: { name?: string; amenity?: string; shop?: string };
}

export default function AddressMapSection({ values, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const mainMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const poiMarkersRef = useRef<CircleMarker[]>([]);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activePoi, setActivePoi] = useState<Record<PoiKey, boolean>>({
    restaurant: true,
    bar: true,
    nightclub: true,
    retail: true,
  });
  const activeCenterRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current!, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const clearPoiMarkers = useCallback(() => {
    for (const m of poiMarkersRef.current) m.remove();
    poiMarkersRef.current = [];
  }, []);

  const loadPoi = useCallback(async (center: [number, number], enabled: Record<PoiKey, boolean>) => {
    if (!mapRef.current) return;
    const L = await import("leaflet");

    clearPoiMarkers();

    const radius = 500;
    const [lat, lon] = center;

    const activeFilters = POI_CATEGORIES.filter((c) => enabled[c.key]);
    if (activeFilters.length === 0) return;

    const unionParts = activeFilters
      .map((c) => `${c.filter}(around:${radius},${lat},${lon});`)
      .join("");

    const query = `[out:json][timeout:10];(${unionParts});out body;`;

    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });
      if (!res.ok) return;
      const data = await res.json() as { elements: OverpassNode[] };

      for (const el of data.elements) {
        // Determine category by checking tags
        const tags = el.tags ?? {};
        let cat = POI_CATEGORIES.find((c) => {
          if (c.key === "retail") return tags.shop !== undefined;
          return tags.amenity === c.key;
        });
        if (!cat) continue;
        if (!enabled[cat.key]) continue;

        const marker = L.circleMarker([el.lat, el.lon], {
          radius: 6,
          color: cat.color,
          fillColor: cat.color,
          fillOpacity: 0.75,
          weight: 1.5,
        }).addTo(mapRef.current!);

        if (tags.name) {
          marker.bindTooltip(tags.name, { permanent: false, direction: "top", offset: [0, -4] });
        }

        poiMarkersRef.current.push(marker);
      }
    } catch {
      /* silently ignore POI errors */
    }
  }, [clearPoiMarkers]);

  const geocode = useCallback(async (fields: AddressFields, enabled: Record<PoiKey, boolean>) => {
    const query = buildQuery(fields);
    if (!query || !mapRef.current) return;

    setGeocoding(true);
    setGeoError(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json() as Array<{ lat: string; lon: string }>;

      if (!data || data.length === 0) {
        setGeoError("Address not found — try adding more detail.");
        setGeocoding(false);
        return;
      }

      const latlng: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      activeCenterRef.current = latlng;

      const L = await import("leaflet");

      if (mainMarkerRef.current) {
        mainMarkerRef.current.setLatLng(latlng);
      } else {
        mainMarkerRef.current = L.marker(latlng).addTo(mapRef.current!);
      }

      mapRef.current!.setView(latlng, 16, { animate: true });
      setGeoError(null);

      void loadPoi(latlng, enabled);
    } catch {
      setGeoError("Could not reach map service. Check your connection.");
    } finally {
      setGeocoding(false);
    }
  }, [loadPoi]);

  useEffect(() => {
    if (!mapReady) return;
    const query = buildQuery(values);
    if (!query) return;

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => { void geocode(values, activePoi); }, 900);

    return () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.addressName, values.addressNumber, values.zipCode, values.addressCountry, mapReady]);

  // When POI toggles change, just reload POI without re-geocoding
  useEffect(() => {
    if (!mapReady || !activeCenterRef.current) return;
    void loadPoi(activeCenterRef.current, activePoi);
  }, [activePoi, mapReady, loadPoi]);

  const set = (key: keyof AddressFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ [key]: e.target.value });

  const togglePoi = (key: PoiKey) =>
    setActivePoi((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="address-section">
      <div className="address-section-header">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="address-section-icon">
          <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.485-2.015-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
        </svg>
        Business Operation Address
      </div>

      <div className="address-fields-grid">
        <div className="field-group">
          <label>Street Name</label>
          <input type="text" value={values.addressName} onChange={set("addressName")} placeholder="e.g. Main Street" />
        </div>
        <div className="field-group">
          <label>Street Number</label>
          <input type="text" value={values.addressNumber} onChange={set("addressNumber")} placeholder="e.g. 123" />
        </div>
        <div className="field-group">
          <label>ZIP / Postal Code</label>
          <input type="text" value={values.zipCode} onChange={set("zipCode")} placeholder="e.g. 90210" />
        </div>
        <div className="field-group">
          <label>Country</label>
          <select value={values.addressCountry} onChange={set("addressCountry")}>
            <option value="">— Select country —</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="address-map-wrap">
        {geocoding && (
          <div className="address-map-overlay">
            <span className="spinner" style={{ width: 16, height: 16 }} />
            <span>Locating…</span>
          </div>
        )}
        {geoError && !geocoding && (
          <div className="address-geo-error">{geoError}</div>
        )}

        {/* POI legend / toggle bar */}
        <div className="address-poi-bar">
          {POI_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`address-poi-btn${activePoi[cat.key] ? " active" : ""}`}
              style={activePoi[cat.key] ? { borderColor: cat.color, color: cat.color } : undefined}
              onClick={() => togglePoi(cat.key)}
            >
              <span className="address-poi-dot" style={{ background: activePoi[cat.key] ? cat.color : "#ccc" }} />
              {cat.label}
            </button>
          ))}
        </div>

        <div ref={mapContainerRef} className="address-map" />
      </div>
    </div>
  );
}
