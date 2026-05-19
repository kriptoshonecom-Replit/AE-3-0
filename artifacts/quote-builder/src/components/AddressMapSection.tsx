import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";

interface AddressFields {
  addressName: string;
  addressNumber: string;
  addressCity: string;
  addressState: string;
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

interface NominatimAddress {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  state?: string;
  county?: string;
  postcode?: string;
  country?: string;
}

interface NominatimReverseResult {
  address: NominatimAddress;
}

interface OverpassElement {
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

const POI_COLORS: Record<string, string> = {
  restaurant: "#f97316",
  bar: "#3b82f6",
  nightclub: "#a855f7",
  cafe: "#92400e",
  bakery: "#d97706",
  fuel: "#16a34a",
};

const POI_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  bar: "Bar",
  nightclub: "Nightclub",
  cafe: "Coffee Shop",
  bakery: "Bakery / Pastry",
  fuel: "Gas Station",
};

const POI_ZOOM_THRESHOLD = 13;

function buildQuery(f: AddressFields): string {
  return [f.addressNumber, f.addressName, f.addressCity, f.addressState, f.zipCode, f.addressCountry]
    .filter(Boolean)
    .join(", ");
}

function matchCountry(raw: string | undefined): string {
  if (!raw) return "United States";
  return COUNTRIES.find((c) => c.toLowerCase() === raw.toLowerCase()) ?? raw;
}

export default function AddressMapSection({ values, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const poiLayerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const skipForwardRef = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(4);

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    setReversing(true);
    setGeoError(null);
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json() as NominatimReverseResult;
      const addr = data.address ?? {};

      skipForwardRef.current += 1;

      onChangeRef.current({
        addressNumber: addr.house_number ?? "",
        addressName: addr.road ?? "",
        addressCity: addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? "",
        addressState: addr.state ?? addr.county ?? "",
        zipCode: addr.postcode ?? "",
        addressCountry: matchCountry(addr.country),
      });
    } catch {
      setGeoError("Could not fetch address for this location.");
    } finally {
      setReversing(false);
    }
  }, []);

  // ── Map initialisation — runs exactly once ────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const reverseGeocodeStable = reverseGeocode;
    const setMapZoomStable = setMapZoom;

    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current!, {
        center: [39.5, -98.35],
        zoom: 4,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
            '© <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      // ── POI layer setup ────────────────────────────────────────────────
      const poiGroup = L.layerGroup().addTo(map);
      poiLayerGroupRef.current = poiGroup;

      async function loadPOIs() {
        const zoom = map.getZoom();
        setMapZoomStable(zoom);

        if (zoom < POI_ZOOM_THRESHOLD) {
          poiGroup.clearLayers();
          return;
        }

        const b = map.getBounds();
        const bbox = [
          b.getSouth().toFixed(4),
          b.getWest().toFixed(4),
          b.getNorth().toFixed(4),
          b.getEast().toFixed(4),
        ].join(",");

        const query =
          `[out:json][timeout:10];` +
          `node["amenity"~"^(restaurant|bar|nightclub|cafe|bakery|fuel)$"](${bbox});` +
          `out body;`;

        try {
          const res = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: query,
          });
          if (!res.ok) return;
          const data = await res.json() as { elements: OverpassElement[] };

          poiGroup.clearLayers();

          for (const el of data.elements) {
            const amenity = el.tags?.amenity ?? "";
            const rawName = el.tags?.name;
            const name = rawName ?? (POI_LABELS[amenity] ?? amenity);
            const color = POI_COLORS[amenity] ?? "#64748b";

            const cm = L.circleMarker([el.lat, el.lon], {
              radius: 6,
              fillColor: color,
              color: "#fff",
              weight: 1.5,
              fillOpacity: 0.9,
              interactive: true,
            }).addTo(poiGroup);

            cm.bindTooltip(name, {
              permanent: false,
              direction: "top",
              className: "poi-tooltip",
            });

            cm.on("click", (e: import("leaflet").LeafletMouseEvent) => {
              L.DomEvent.stopPropagation(e);
              if (markerRef.current) {
                markerRef.current.setLatLng([el.lat, el.lon]);
              } else {
                markerRef.current = L.marker([el.lat, el.lon]).addTo(map);
              }
              void reverseGeocodeStable(el.lat, el.lon);
            });
          }
        } catch {
          // Silently ignore POI loading errors — map still works without them
        }
      }

      // Debounced POI loader so rapid panning doesn't spam Overpass
      function schedulePOILoad() {
        if (poiTimer.current) clearTimeout(poiTimer.current);
        poiTimer.current = setTimeout(() => { void loadPOIs(); }, 600);
      }

      map.on("moveend", schedulePOILoad);
      map.on("zoomend", schedulePOILoad);
      map.on("zoom", () => { setMapZoomStable(map.getZoom()); });

      // ── Click / POI tap → place pin + reverse geocode ─────────────────
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        void reverseGeocodeStable(lat, lng);
      });

      mapRef.current = map;
      setMapReady(true);

      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 300);
    });

    return () => {
      if (poiTimer.current) clearTimeout(poiTimer.current);
      poiLayerGroupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Forward geocode (fields → pin) ───────────────────────────────────
  const geocode = useCallback(async (fields: AddressFields) => {
    const query = buildQuery(fields);
    if (!query || !mapRef.current) return;

    setGeocoding(true);
    setGeoError(null);

    try {
      const url =
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json() as Array<{ lat: string; lon: string }>;

      if (!data || data.length === 0) {
        setGeoError("Address not found — try adding more detail.");
        return;
      }

      const latlng: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      const L = await import("leaflet");

      if (markerRef.current) {
        markerRef.current.setLatLng(latlng);
      } else {
        markerRef.current = L.marker(latlng).addTo(mapRef.current!);
      }

      mapRef.current!.setView(latlng, 16, { animate: true });
      setGeoError(null);
    } catch {
      setGeoError("Could not reach map service. Check your connection.");
    } finally {
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    if (!mapReady) return;

    if (skipForwardRef.current > 0) {
      skipForwardRef.current -= 1;
      return;
    }

    const query = buildQuery(values);
    if (!query) return;

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => { void geocode(values); }, 900);

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.addressName, values.addressNumber, values.addressCity, values.addressState, values.zipCode, values.addressCountry, mapReady, geocode]);

  const set = (key: keyof AddressFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ [key]: e.target.value });

  const busy = geocoding || reversing;
  const showPOILegend = mapZoom >= POI_ZOOM_THRESHOLD;

  return (
    <div className="address-section">
      <div className="address-fields-grid">
        <div className="field-group">
          <label>Street Name</label>
          <input
            type="text" value={values.addressName}
            onChange={set("addressName")} placeholder="e.g. Main Street"
          />
        </div>
        <div className="field-group">
          <label>Street Number</label>
          <input
            type="text" value={values.addressNumber}
            onChange={set("addressNumber")} placeholder="e.g. 123"
          />
        </div>
        <div className="field-group">
          <label>State / Province</label>
          <input
            type="text" value={values.addressState}
            onChange={set("addressState")} placeholder="e.g. California"
          />
        </div>
        <div className="field-group">
          <label>ZIP / Postal Code</label>
          <input
            type="text" value={values.zipCode}
            onChange={set("zipCode")} placeholder="e.g. 90210"
          />
        </div>
        <div className="field-group span-2">
          <div className="address-city-country-row">
            <div className="field-group address-city-field">
              <label>City</label>
              <input
                type="text" value={values.addressCity}
                onChange={set("addressCity")} placeholder="e.g. Los Angeles"
              />
            </div>
            <div className="field-group address-country-field">
              <label>Country</label>
              <select value={values.addressCountry} onChange={set("addressCountry")}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="address-map-wrap">
        {busy && (
          <div className="address-map-overlay">
            <span className="spinner" style={{ width: 16, height: 16 }} />
            <span>{reversing ? "Reading location…" : "Locating…"}</span>
          </div>
        )}
        {geoError && !busy && (
          <div className="address-geo-error">{geoError}</div>
        )}
        <div
          ref={mapContainerRef}
          className="address-map"
          style={{
            cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='28' viewBox='0 0 20 28'%3E%3Cpath d='M10 2 L10 22 M4 16 L10 24 L16 16' stroke='%23333333' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") 10 24, crosshair`,
          }}
        />
        <div className="address-map-hint">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {showPOILegend
            ? "Click a coloured dot or anywhere on the map to auto-fill the address fields"
            : "Click anywhere on the map — or zoom in closer to see restaurant, bar & nightclub markers"}
        </div>
      </div>

      {showPOILegend && (
        <div className="poi-legend">
          {Object.entries(POI_LABELS).map(([key, label]) => (
            <span key={key} className="poi-legend-item">
              <span className="poi-dot" style={{ background: POI_COLORS[key] }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
