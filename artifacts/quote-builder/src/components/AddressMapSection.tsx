import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";

// addressLine is the single visible field; the individual fields are still
// populated by reverse-geocode so PDF / amendments continue to work.
interface AddressFields {
  addressLine: string;
  addressName: string;
  addressNumber: string;
  addressCity: string;
  addressState: string;
  zipCode: string;
  addressCountry: string;
}

interface BillingFields {
  billingAddressLine: string;
  billingAddressName: string;
  billingAddressNumber: string;
  billingAddressCity: string;
  billingAddressState: string;
  billingZipCode: string;
  billingAddressCountry: string;
}

interface Props {
  values: AddressFields;
  onChange: (fields: Partial<AddressFields>) => void;
  sameForBilling?: boolean;
  billingValues?: Partial<BillingFields>;
  onBillingChange?: (fields: Partial<BillingFields & { sameForBilling: boolean }>) => void;
}

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

// Atlanta, GA — default map centre
const DEFAULT_LAT = 33.749;
const DEFAULT_LON = -84.388;
const DEFAULT_ZOOM = 12;

function matchCountry(raw: string | undefined): string {
  if (!raw) return "United States";
  const COUNTRIES = [
    "United States", "Canada", "Mexico", "United Kingdom", "Australia",
    "Germany", "France", "Spain", "Italy", "Netherlands", "Belgium",
    "Switzerland", "Austria", "Portugal", "Denmark", "Sweden", "Norway",
    "Finland", "Ireland", "New Zealand", "Japan", "South Korea", "Singapore",
    "Hong Kong", "India", "Brazil", "Argentina", "Chile", "Colombia",
    "South Africa", "UAE", "Saudi Arabia", "Israel", "Turkey", "Poland",
    "Czech Republic", "Hungary", "Romania", "Greece", "Croatia",
  ];
  return COUNTRIES.find((c) => c.toLowerCase() === raw.toLowerCase()) ?? raw;
}

function composeAddressLine(addr: NominatimAddress): string {
  const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
  const city   = addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? "";
  const stateZip = [addr.state ?? addr.county ?? "", addr.postcode ?? ""].filter(Boolean).join(" ");
  const country  = matchCountry(addr.country);
  return [street, city, stateZip, country].filter(Boolean).join(", ");
}

export default function AddressMapSection({
  values, onChange,
  sameForBilling = true, billingValues = {}, onBillingChange,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<LeafletMap | null>(null);
  const markerRef       = useRef<import("leaflet").Marker | null>(null);
  const geocodeTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const skipForwardRef = useRef(0);

  const [mapReady,  setMapReady]  = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [geoError,  setGeoError]  = useState<string | null>(null);

  // ── Reverse geocode: pin click → fill single address line + individual fields ──
  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    setReversing(true);
    setGeoError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
      const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json() as NominatimReverseResult;
      const addr = data.address ?? {};

      skipForwardRef.current += 1;

      onChangeRef.current({
        addressLine:    composeAddressLine(addr),
        addressNumber:  addr.house_number ?? "",
        addressName:    addr.road ?? "",
        addressCity:    addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? "",
        addressState:   addr.state ?? addr.county ?? "",
        zipCode:        addr.postcode ?? "",
        addressCountry: matchCountry(addr.country),
      });
    } catch {
      setGeoError("Could not fetch address for this location.");
    } finally {
      setReversing(false);
    }
  }, []);

  // ── Map initialisation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const reverseGeocodeStable = reverseGeocode;

    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current!, {
        center: [DEFAULT_LAT, DEFAULT_LON],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community",
          maxZoom: 19,
        }
      ).addTo(map);

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
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      mapRef.current?.remove();
      mapRef.current   = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Forward geocode: single address line → pin ─────────────────────────
  const geocode = useCallback(async (query: string) => {
    if (!query || !mapRef.current) return;
    setGeocoding(true);
    setGeoError(null);
    try {
      const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
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
    if (skipForwardRef.current > 0) { skipForwardRef.current -= 1; return; }
    const query = values.addressLine.trim();
    if (!query) return;
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => { void geocode(query); }, 900);
    return () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.addressLine, mapReady, geocode]);

  const busy = geocoding || reversing;

  return (
    <div className="address-section">

      {/* Single address input */}
      <div className="field-group">
        <label>Address</label>
        <input
          type="text"
          value={values.addressLine}
          onChange={(e) => onChange({ addressLine: e.target.value })}
          placeholder="e.g. 123 Main St, Atlanta, GA 30301"
        />
      </div>

      {/* Map */}
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
            cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='28' viewBox='0 0 20 28'%3E%3Cpath d='M10 2 L10 22 M4 16 L10 24 L16 16' stroke='%23ffffff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") 10 24, crosshair`,
          }}
        />
        <div className="address-map-hint">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Click anywhere on the map to pin a location and auto-fill the address field
        </div>
      </div>

      {/* Same for Billing */}
      <label className="address-billing-toggle">
        <input
          type="checkbox"
          checked={sameForBilling}
          onChange={(e) => onBillingChange?.({ sameForBilling: e.target.checked })}
        />
        <span>Same for Billing</span>
      </label>

      {/* Billing address — single line, no map */}
      {!sameForBilling && (
        <div className="address-billing-section">
          <div className="address-billing-title">Billing Operation Address</div>
          <div className="field-group">
            <label>Billing Address</label>
            <input
              type="text"
              value={billingValues.billingAddressLine ?? ""}
              onChange={(e) => onBillingChange?.({ billingAddressLine: e.target.value })}
              placeholder="e.g. 456 Oak Ave, Atlanta, GA 30301"
            />
          </div>
        </div>
      )}
    </div>
  );
}
