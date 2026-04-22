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
        instaduration: item.instaduration ?? 0,
        stageduration: item.stageduration ?? 0,
        produration:   item.produration   ?? 0,
        traduration:   item.traduration   ?? 0,
        sitecopyproduration: item.sitecopyproduration,
        sitecopytradiration: item.sitecopytradiration,
      });
    }
  }
  return map;
}

const DEFAULT_CATALOG_MAP = buildProductCatalogMap(productsData.categories as unknown as ProductCategory[]);

function getProductDuration(productId: string, field: DurationField, pitType: string, catalogMap: ProductCatalogMap): number {
  const entry = catalogMap.get(productId);
  if (!entry) return 0;
  if (pitType === "site-copy") {
    if (field === "produration" && entry.sitecopyproduration !== undefined) return entry.sitecopyproduration;
    if (field === "traduration" && entry.sitecopytradiration !== undefined) return entry.sitecopytradiration;
  }
  return entry[field];
}

const CATEGORY_DURATION_FIELD: Record<string, DurationField> = {
  install:     "instaduration",
  staging:     "stageduration",
  programming: "produration",
  training:    "traduration",
};

// ── Static structure (names only — durations come from catalog) ───────────────
const PIT_CATEGORIES = [
  {
    id: "programming",
    name: "Programming",
    lineItems: [
      { id: "pro-001", name: "Programming Connected Payments" },
      { id: "pro-002", name: "Programming Online Ordering" },
      { id: "pro-003", name: "Programming Consumer Marketing" },
      { id: "pro-004", name: "Programming Insight or Console" },
      { id: "pro-005", name: "Programming Aloha API's (BSP)" },
      { id: "pro-006", name: "Programming Kitchen Custom" },
      { id: "pro-007", name: "Programming OrderPay" },
      { id: "pro-008", name: "Programming Aloha Delivery" },
    ],
  },
  {
    id: "training",
    name: "Training",
    lineItems: [
      { id: "tr-001", name: "Training Connected Payments" },
      { id: "tr-002", name: "Training Consumer Marketing" },
      { id: "tr-003", name: "Training Insight or Console" },
      { id: "tr-004", name: "Training Online Ordering" },
      { id: "tr-005", name: "Training Aloha Kitchen" },
      { id: "tr-006", name: "Training OrderPay" },
    ],
  },
  {
    id: "install",
    name: "Install",
    lineItems: [
      { id: "ins-001", name: "Install Terminal" },
      { id: "ins-002", name: "Install Server" },
      { id: "ins-003", name: "Install Tablet" },
      { id: "ins-004", name: "Install Displays" },
      { id: "ins-005", name: "Install KDS" },
      { id: "ins-006", name: "Install Printers" },
      { id: "ins-007", name: "Install PinPads" },
      { id: "ins-008", name: "Install Handheld" },
    ],
  },
  {
    id: "staging",
    name: "Staging",
    lineItems: [
      { id: "sta-001", name: "Staging Terminal" },
      { id: "sta-002", name: "Staging Server" },
      { id: "sta-003", name: "Staging Tablet" },
      { id: "sta-004", name: "Staging Displays" },
      { id: "sta-005", name: "Staging KDS" },
      { id: "sta-006", name: "Staging Printers" },
      { id: "sta-007", name: "Staging PinPads" },
      { id: "sta-008", name: "Staging Handheld" },
    ],
  },
];

// ── Toggle-driven durations (no product entry in catalog) ─────────────────────
const TOGGLE_DURATIONS: Record<string, number> = {
  "pro-001": 2,
  "pro-002": 10,
  "tr-001":  2,
  "tr-004":  2,
};

// ── Product mappings ──────────────────────────────────────────────────────────
type ProductMapping =
  | { type: "category";    categoryIds: string[] }
  | { type: "product";     productIds:  string[] }
  | { type: "product-qty"; productIds:  string[] };

const PIT_ITEM_MAPPING: Record<string, ProductMapping> = {
  "ins-001": { type: "product-qty",  productIds:  ["tm-001", "tm-002"] },
  "ins-002": { type: "product-qty",  productIds:  ["se-001", "se-002"] },
  "ins-003": { type: "product-qty",  productIds:  ["ta-001", "ta-002", "ta-003"] },
  "ins-004": { type: "product-qty",  productIds:  ["dp-001", "dp-002"] },
  "ins-005": { type: "category",     categoryIds: ["expo", "prep"] },
  "ins-006": { type: "product-qty",  productIds:  ["pr-001", "pr-002", "pr-003", "pr-004", "pr-005"] },
  "ins-007": { type: "product-qty",  productIds:  ["pi-001", "pi-002", "pi-003", "pi-004", "pi-005", "pi-006", "pi-008", "pi-009"] },
  "ins-008": { type: "product-qty",  productIds:  ["ha-001", "ha-002"] },

  "sta-001": { type: "product-qty",  productIds:  ["tm-001", "tm-002"] },
  "sta-002": { type: "product-qty",  productIds:  ["se-001", "se-002"] },
  "sta-003": { type: "product-qty",  productIds:  ["ta-001", "ta-002", "ta-003"] },
  "sta-004": { type: "product-qty",  productIds:  ["dp-001", "dp-002"] },
  "sta-005": { type: "category",     categoryIds: ["expo", "prep"] },
  "sta-006": { type: "product-qty",  productIds:  ["pr-001", "pr-002", "pr-003", "pr-004", "pr-005"] },
  "sta-007": { type: "product-qty",  productIds:  ["pi-001", "pi-002", "pi-003", "pi-004", "pi-005", "pi-006", "pi-008", "pi-009"] },
  "sta-008": { type: "product-qty",  productIds:  ["ha-001", "ha-002"] },

  "pro-003": { type: "product",      productIds:  ["sa-001"] },
  "pro-004": { type: "product",      productIds:  ["sa-002", "sa-003"] },
  "pro-005": { type: "product",      productIds:  ["sa-005"] },
  "pro-006": { type: "product",      productIds:  ["exp-001", "prp-001"] },
  "pro-007": { type: "product",      productIds:  ["ha-001", "ha-002"] },
  "pro-008": { type: "product",      productIds:  ["sa-007"] },

  "tr-002":  { type: "product",      productIds:  ["sa-001"] },
  "tr-003":  { type: "product",      productIds:  ["sa-002", "sa-003"] },
  "tr-005":  { type: "product",      productIds:  ["exp-001", "prp-001"] },
  "tr-006":  { type: "product",      productIds:  ["ha-001", "ha-002"] },
};

const YES_NO_ITEM_MAP: Record<string, string[]> = {
  "connected-payments-yn": ["pro-001", "tr-001"],
  "online-ordering-yn":    ["pro-002", "tr-004"],
};

const OPTIONAL_PROG_ITEM_MAP: Record<string, string[]> = {
  "consumer-marketing": ["pro-003", "tr-002"],
  "insight-or-console": ["pro-004", "tr-003"],
  "aloha-api":          ["pro-005"],
  "kitchen":            ["pro-006", "tr-005"],
  "orderpay":           ["pro-007", "tr-006"],
  "aloha-delivery":     ["pro-008"],
};

// ── Duration computation ──────────────────────────────────────────────────────
function computeHours(itemId: string, catId: string, groups: QuoteGroup[], pitType: string, catalogMap: ProductCatalogMap): number {
  const mapping = PIT_ITEM_MAPPING[itemId];
  if (!mapping) return 0;

  const field = CATEGORY_DURATION_FIELD[catId];

  if (mapping.type === "product-qty") {
    let total = 0;
    for (const group of groups) {
      for (const li of group.lineItems) {
        if (mapping.productIds.includes(li.productId)) {
          total += li.quantity * getProductDuration(li.productId, field, pitType, catalogMap);
        }
      }
    }
    return total;
  }

  if (mapping.type === "product") {
    for (const group of groups) {
      for (const li of group.lineItems) {
        if (mapping.productIds.includes(li.productId) && li.quantity > 0) {
          return getProductDuration(li.productId, field, pitType, catalogMap);
        }
      }
    }
    return 0;
  }

  if (mapping.type === "category") {
    let total = 0;
    for (const group of groups) {
      if (mapping.categoryIds.includes(group.categoryId)) {
        for (const li of group.lineItems) {
          total += li.quantity * getProductDuration(li.productId, field, pitType, catalogMap);
        }
      }
    }
    return total;
  }

  return 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildExcludedItemIds(optionalProgramToggles: Record<string, boolean>): Set<string> {
  const excluded = new Set<string>();
  for (const [toggleId, itemIds] of Object.entries(OPTIONAL_PROG_ITEM_MAP)) {
    if (!(optionalProgramToggles[toggleId] ?? true)) {
      for (const id of itemIds) excluded.add(id);
    }
  }
  return excluded;
}

export function computeProductRelatedPitTotal(
  groups: QuoteGroup[],
  yesNoToggles: Record<string, boolean>,
  optionalProgramToggles: Record<string, boolean> = {},
  pitType: string = "",
  catalogMap: ProductCatalogMap = DEFAULT_CATALOG_MAP,
  pitHourlyRate: number = PIT_HOURLY_RATE,
): number {
  const forcedItemIds = Object.entries(YES_NO_ITEM_MAP)
    .filter(([toggleId]) => yesNoToggles[toggleId])
    .flatMap(([, itemIds]) => itemIds);

  const excludedItemIds = buildExcludedItemIds(optionalProgramToggles);

  let total = 0;
  for (const cat of PIT_CATEGORIES) {
    for (const item of cat.lineItems) {
      if (excludedItemIds.has(item.id)) continue;
      const forced = forcedItemIds.includes(item.id);
      const hours = forced
        ? (TOGGLE_DURATIONS[item.id] ?? 0)
        : computeHours(item.id, cat.id, groups, pitType, catalogMap);
      total += hours * pitHourlyRate;
    }
  }
  return total;
}

// ── Category table component ──────────────────────────────────────────────────
interface PitItem { id: string; name: string }
interface PitCat  { id: string; name: string; lineItems: PitItem[] }

interface CategoryTableProps {
  category: PitCat;
  groups: QuoteGroup[];
  forcedItemIds: string[];
  excludedItemIds: Set<string>;
  pitType: string;
  catalogMap: ProductCatalogMap;
  pitHourlyRate: number;
}

function CategoryTable({ category, groups, forcedItemIds, excludedItemIds, pitType, catalogMap, pitHourlyRate }: CategoryTableProps) {
  const rows = category.lineItems
    .filter((item) => !excludedItemIds.has(item.id))
    .map((item) => {
      const forced = forcedItemIds.includes(item.id);
      const hours = forced
        ? (TOGGLE_DURATIONS[item.id] ?? 0)
        : computeHours(item.id, category.id, groups, pitType, catalogMap);
      return { item, hours, price: hours * pitHourlyRate };
    })
    .filter((r) => r.hours > 0);

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalPrice = rows.reduce((s, r) => s + r.price, 0);

  return (
    <div className="prpit-category">
      <div className="prpit-category-title">{category.name}</div>
      {rows.length === 0 ? (
        <div className="prpit-empty">
          No {category.name.toLowerCase()} services based on current products.
        </div>
      ) : (
        <div className="pit-items">
          <div className="pit-items-header">
            <span className="pit-col-name">Line Items</span>
            <span className="pit-col-duration">Hrs</span>
            <span className="pit-col-price">Price</span>
          </div>
          <div className="pit-items-list">
            {rows.map(({ item, hours, price }) => (
              <div key={item.id} className="pit-item-row">
                <span className="pit-item-name">{item.name}</span>
                <span className="pit-item-duration">
                  {hours} hr{hours !== 1 ? "s" : ""}
                </span>
                <span className="pit-item-price">${price.toFixed(2)}</span>
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

export default function ProductRelatedPitSection({ groups, yesNoToggles, optionalProgramToggles, pitType, catalogMap, pitHourlyRate }: Props) {
  const map = catalogMap ?? DEFAULT_CATALOG_MAP;
  const rate = pitHourlyRate ?? PIT_HOURLY_RATE;
  const hasAnyProducts = groups.some((g) => g.lineItems.length > 0);

  const forcedItemIds = Object.entries(YES_NO_ITEM_MAP)
    .filter(([toggleId]) => yesNoToggles[toggleId])
    .flatMap(([, itemIds]) => itemIds);

  const excludedItemIds = buildExcludedItemIds(optionalProgramToggles);
  const hasContent = hasAnyProducts || forcedItemIds.length > 0;

  return (
    <div className="prpit-card">
      {!hasContent ? (
        <div className="prpit-placeholder">
          Add products to the Line Items section to see related PIT services.
        </div>
      ) : (
        <div className="prpit-grid">
          {PIT_CATEGORIES.map((cat) => (
            <CategoryTable
              key={cat.id}
              category={cat}
              groups={groups}
              forcedItemIds={forcedItemIds}
              excludedItemIds={excludedItemIds}
              pitType={pitType}
              catalogMap={map}
              pitHourlyRate={rate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
