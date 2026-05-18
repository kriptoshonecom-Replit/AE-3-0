import type { QuoteGroup, ProductCategory } from "../types";
import productsData from "../data/products.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";

// ── Product catalog lookup ────────────────────────────────────────────────────
type DurationField = "instaduration" | "stageduration" | "produration" | "traduration";

type CatalogEntry = Record<DurationField, number> & {
  sitecopyproduration: number | undefined;
  sitecopytradiration: number | undefined;
};

export type ProductCatalogMap = Map<string, CatalogEntry>;

export function buildProductCatalogMap(categories: ProductCategory[]): ProductCatalogMap {
  const map: ProductCatalogMap = new Map();
  for (const cat of categories) {
    for (const item of cat.items) {
      map.set(item.id, {
        instaduration:       item.instaduration       ?? 0,
        stageduration:       item.stageduration       ?? 0,
        produration:         item.produration         ?? 0,
        traduration:         item.traduration         ?? 0,
        sitecopyproduration: item.sitecopyproduration,
        sitecopytradiration: item.sitecopytradiration,
      });
    }
  }
  return map;
}

const DEFAULT_CATALOG_MAP = buildProductCatalogMap(
  productsData.categories as unknown as ProductCategory[],
);

function getProductDuration(
  productId: string,
  field: DurationField,
  pitType: string,
  catalogMap: ProductCatalogMap,
): number {
  const entry = catalogMap.get(productId);
  if (!entry) return 0;
  if (pitType === "site-copy") {
    if (field === "produration" && entry.sitecopyproduration !== undefined)
      return entry.sitecopyproduration;
    if (field === "traduration" && entry.sitecopytradiration !== undefined)
      return entry.sitecopytradiration;
  }
  return entry[field];
}

// ── Merged product groups ─────────────────────────────────────────────────────
// Products that share identical Pro/Train hours appear as a single line item
// in Programming & Training, and as a single optional toggle in PitSection.
export const MERGED_PRODUCT_GROUPS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly productIds: ReadonlyArray<string>;
}> = [
  { id: "kds-solution", label: "KDS Solution", productIds: ["exp-001", "prp-001"] },
] as const;

// Fast lookup: productId → its merged group (if any)
export const MERGED_PRODUCT_LOOKUP: ReadonlyMap<string, typeof MERGED_PRODUCT_GROUPS[0]> = new Map(
  MERGED_PRODUCT_GROUPS.flatMap((g) => g.productIds.map((pid) => [pid, g] as const)),
);

// ── Section definitions ───────────────────────────────────────────────────────
// Install & Staging scale by quantity (qty × duration).
// Programming & Training are presence-based (one entry per unique product in quote).
interface PitSectionDef {
  id: "install" | "staging" | "programming" | "training";
  name: string;
  field: DurationField;
  scaleByQty: boolean;
}

const PIT_SECTIONS: PitSectionDef[] = [
  { id: "programming", name: "Programming", field: "produration",   scaleByQty: false },
  { id: "training",    name: "Training",    field: "traduration",   scaleByQty: false },
  { id: "install",     name: "Install",     field: "instaduration", scaleByQty: true  },
  { id: "staging",     name: "Staging",     field: "stageduration", scaleByQty: true  },
];

// ── Toggle-driven rows (not tied to products, hours are fixed) ────────────────
const TOGGLE_ROWS: Array<{
  toggleId: string;
  section: "programming" | "training";
  name: string;
  hours: number;
}> = [
  { toggleId: "connected-payments-yn", section: "programming", name: "Programming Connected Payments", hours: 2  },
  { toggleId: "connected-payments-yn", section: "training",    name: "Training Connected Payments",    hours: 2  },
  { toggleId: "online-ordering-yn",    section: "programming", name: "Programming Online Ordering",    hours: 10 },
  { toggleId: "online-ordering-yn",    section: "training",    name: "Training Online Ordering",       hours: 2  },
];

// ── Row type ──────────────────────────────────────────────────────────────────
interface PitRow { name: string; hours: number; price: number }

// ── Core computation ──────────────────────────────────────────────────────────
function computeSectionRows(
  section: PitSectionDef,
  groups: QuoteGroup[],
  yesNoToggles: Record<string, boolean>,
  optionalProgramToggles: Record<string, boolean>,
  pitType: string,
  catalogMap: ProductCatalogMap,
  rate: number,
): PitRow[] {
  const rows: PitRow[] = [];

  // Toggle-driven rows (programming & training only)
  if (section.id === "programming" || section.id === "training") {
    for (const tr of TOGGLE_ROWS) {
      if (tr.section === section.id && yesNoToggles[tr.toggleId]) {
        rows.push({ name: tr.name, hours: tr.hours, price: tr.hours * rate });
      }
    }
  }

  // Product-driven rows — every product's Install/Stage/Pro/Train field is used directly
  const seen = new Set<string>(); // dedup for presence-based sections
  for (const group of groups) {
    for (const li of group.lineItems) {
      if (li.quantity <= 0) continue;
      const hrs = getProductDuration(li.productId, section.field, pitType, catalogMap);
      if (hrs <= 0) continue;

      if (section.scaleByQty) {
        // Install / Staging: qty × duration (never filtered by optional toggle)
        const totalHrs = li.quantity * hrs;
        const label = li.quantity > 1
          ? `${li.productName} ×${li.quantity}`
          : li.productName;
        rows.push({ name: label, hours: totalHrs, price: totalHrs * rate });
      } else {
        // Programming / Training: presence-based, respects optional program toggle.
        // Products in a merged group collapse into one entry under the group label.
        const mergedGroup = MERGED_PRODUCT_LOOKUP.get(li.productId);
        const toggleKey = mergedGroup ? mergedGroup.id : li.productId;
        const seenKey  = mergedGroup ? mergedGroup.id : li.productId;
        const label    = mergedGroup ? mergedGroup.label : li.productName;

        if (optionalProgramToggles[toggleKey] === false) continue;
        if (!seen.has(seenKey)) {
          seen.add(seenKey);
          rows.push({ name: label, hours: hrs, price: hrs * rate });
        }
      }
    }
  }

  return rows;
}

// ── Exported helpers (used by QuoteBuilder, PDF export, recurring calc) ───────
export function computeProductRelatedPitTotal(
  groups: QuoteGroup[],
  yesNoToggles: Record<string, boolean>,
  optionalProgramToggles: Record<string, boolean> = {},
  pitType: string = "",
  catalogMap: ProductCatalogMap = DEFAULT_CATALOG_MAP,
  pitHourlyRate: number = PIT_HOURLY_RATE,
): number {
  let total = 0;
  for (const section of PIT_SECTIONS) {
    for (const row of computeSectionRows(section, groups, yesNoToggles, optionalProgramToggles, pitType, catalogMap, pitHourlyRate)) {
      total += row.price;
    }
  }
  return total;
}

export function computeProductRelatedPitHours(
  groups: QuoteGroup[],
  yesNoToggles: Record<string, boolean>,
  optionalProgramToggles: Record<string, boolean> = {},
  pitType: string = "",
  catalogMap: ProductCatalogMap = DEFAULT_CATALOG_MAP,
): number {
  let total = 0;
  for (const section of PIT_SECTIONS) {
    // rate=1 means price === hours, so we can reuse computeSectionRows
    for (const row of computeSectionRows(section, groups, yesNoToggles, optionalProgramToggles, pitType, catalogMap, 1)) {
      total += row.hours;
    }
  }
  return total;
}

// ── Section table component ───────────────────────────────────────────────────
interface SectionTableProps {
  section: PitSectionDef;
  rows: PitRow[];
}

function SectionTable({ section, rows }: SectionTableProps) {
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalPrice = rows.reduce((s, r) => s + r.price, 0);

  return (
    <div className="prpit-category">
      <div className="prpit-category-title">{section.name}</div>
      {rows.length === 0 ? (
        <div className="prpit-empty">
          No {section.name.toLowerCase()} services based on current products.
        </div>
      ) : (
        <div className="pit-items">
          <div className="pit-items-header">
            <span className="pit-col-name">Line Items</span>
            <span className="pit-col-duration">Hrs</span>
            <span className="pit-col-price">Price</span>
          </div>
          <div className="pit-items-list">
            {rows.map((row, i) => (
              <div key={i} className="pit-item-row">
                <span className="pit-item-name">{row.name}</span>
                <span className="pit-item-duration">
                  {row.hours} hr{row.hours !== 1 ? "s" : ""}
                </span>
                <span className="pit-item-price">${row.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="pit-items-total">
            <span className="pit-col-name">Total</span>
            <span className="pit-col-duration">{totalHours} hrs</span>
            <span className="pit-col-price">${totalPrice.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  groups: QuoteGroup[];
  yesNoToggles: Record<string, boolean>;
  optionalProgramToggles: Record<string, boolean>;
  pitType: string;
  catalogMap?: ProductCatalogMap;
  pitHourlyRate?: number;
}

export default function ProductRelatedPitSection({
  groups,
  yesNoToggles,
  optionalProgramToggles,
  pitType,
  catalogMap,
  pitHourlyRate,
}: Props) {
  const map = catalogMap ?? DEFAULT_CATALOG_MAP;
  const rate = pitHourlyRate ?? PIT_HOURLY_RATE;

  const hasContent =
    groups.some((g) => g.lineItems.some((li) => li.quantity > 0)) ||
    Object.values(yesNoToggles).some(Boolean);

  const sectionRows = PIT_SECTIONS.map((section) => ({
    section,
    rows: computeSectionRows(section, groups, yesNoToggles, optionalProgramToggles, pitType, map, rate),
  }));

  const grandHours = sectionRows.reduce(
    (s, { rows }) => s + rows.reduce((ss, r) => ss + r.hours, 0),
    0,
  );
  const grandTotal = sectionRows.reduce(
    (s, { rows }) => s + rows.reduce((ss, r) => ss + r.price, 0),
    0,
  );

  return (
    <div className="prpit-card">
      {!hasContent ? (
        <div className="prpit-placeholder">
          Add products to the Line Items section to see related PIT services.
        </div>
      ) : (
        <>
          <div className="prpit-grid">
            {sectionRows.map(({ section, rows }) => (
              <SectionTable key={section.id} section={section} rows={rows} />
            ))}
          </div>

          {grandHours > 0 && (
            <div className="prpit-grand-total">
              <span className="prpit-grand-label">Grand Total</span>
              <div className="prpit-grand-stats">
                <div className="prpit-grand-stat">
                  <span className="prpit-grand-stat-value">
                    {grandHours} hr{grandHours !== 1 ? "s" : ""}
                  </span>
                  <span className="prpit-grand-stat-label">Total Hours</span>
                </div>
                <div className="prpit-grand-divider" />
                <div className="prpit-grand-stat">
                  <span className="prpit-grand-stat-value">
                    ${grandTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="prpit-grand-stat-label">Total Amount</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
