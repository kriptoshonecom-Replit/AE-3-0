import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap } from "leaflet";

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

function buildQuery(f: AddressFields): string {
  return [f.addressNumber, f.addressName, f.zipCode, f.addressCountry]
    .filter(Boolean)
    .join(", ");
}

export default function AddressMapSection({ values, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Init Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      // Fix default icon paths for Vite bundling
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
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

  // Geocode address and move map
  const geocode = useCallback(async (fields: AddressFields) => {
    const query = buildQuery(fields);
    if (!query || !mapRef.current) return;

    setGeocoding(true);
    setGeoError(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;

      if (!data || data.length === 0) {
        setGeoError("Address not found — try adding more detail.");
        setGeocoding(false);
        return;
      }

      const { lat, lon } = data[0];
      const latlng: [number, number] = [parseFloat(lat), parseFloat(lon)];

      const L = (await import("leaflet")).default ?? (await import("leaflet"));

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

  // Debounce geocoding when address fields change
  useEffect(() => {
    if (!mapReady) return;
    const query = buildQuery(values);
    if (!query) return;

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => { void geocode(values); }, 900);

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [values.addressName, values.addressNumber, values.zipCode, values.addressCountry, mapReady, geocode]);

  const set = (key: keyof AddressFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ [key]: e.target.value });

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
          <input
            type="text"
            value={values.addressName}
            onChange={set("addressName")}
            placeholder="e.g. Main Street"
          />
        </div>

        <div className="field-group">
          <label>Street Number</label>
          <input
            type="text"
            value={values.addressNumber}
            onChange={set("addressNumber")}
            placeholder="e.g. 123"
          />
        </div>

        <div className="field-group">
          <label>ZIP / Postal Code</label>
          <input
            type="text"
            value={values.zipCode}
            onChange={set("zipCode")}
            placeholder="e.g. 90210"
          />
        </div>

        <div className="field-group">
          <label>Country</label>
          <select value={values.addressCountry} onChange={set("addressCountry")}>
            <option value="">— Select country —</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
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
        <div ref={mapContainerRef} className="address-map" />
      </div>
    </div>
  );
}
