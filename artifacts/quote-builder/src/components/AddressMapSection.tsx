import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap } from "leaflet";

interface AddressFields {
  addressName: string;
  addressNumber: string;
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
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

interface NominatimReverseResult {
  address: NominatimAddress;
}

function buildQuery(f: AddressFields): string {
  return [f.addressNumber, f.addressName, f.addressState, f.zipCode, f.addressCountry]
    .filter(Boolean)
    .join(", ");
}

function matchCountry(raw: string | undefined): string {
  if (!raw) return "United States";
  const found = COUNTRIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase()
  );
  return found ?? raw;
}

export default function AddressMapSection({ values, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipForwardRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    setReversing(true);
    setGeoError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json() as NominatimReverseResult;
      const addr = data.address ?? {};

      skipForwardRef.current = true;
      onChange({
        addressNumber: addr.house_number ?? "",
        addressName: addr.road ?? "",
        addressState: addr.state ?? addr.county ?? "",
        zipCode: addr.postcode ?? "",
        addressCountry: matchCountry(addr.country),
      });

      setTimeout(() => { skipForwardRef.current = false; }, 1500);
    } catch {
      setGeoError("Could not fetch address for this location.");
    } finally {
      setReversing(false);
    }
  }, [onChange]);

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
        center: [39.5, -98.35],
        zoom: 4,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        void reverseGeocode(lat, lng);
      });

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [reverseGeocode]);

  const geocode = useCallback(async (fields: AddressFields) => {
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
    if (!mapReady || skipForwardRef.current) return;
    const query = buildQuery(values);
    if (!query) return;

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => { void geocode(values); }, 900);

    return () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.addressName, values.addressNumber, values.addressState, values.zipCode, values.addressCountry, mapReady, geocode]);

  const set = (key: keyof AddressFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ [key]: e.target.value });

  const busy = geocoding || reversing;

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
          <label>State / Province</label>
          <input type="text" value={values.addressState} onChange={set("addressState")} placeholder="e.g. California" />
        </div>
        <div className="field-group">
          <label>ZIP / Postal Code</label>
          <input type="text" value={values.zipCode} onChange={set("zipCode")} placeholder="e.g. 90210" />
        </div>
        <div className="field-group span-2">
          <label>Country</label>
          <select value={values.addressCountry} onChange={set("addressCountry")}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
        <div ref={mapContainerRef} className="address-map" style={{ cursor: "crosshair" }} />
        <div className="address-map-hint">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Click anywhere on the map — or select a POI — to auto-fill address fields
        </div>
      </div>
    </div>
  );
}
