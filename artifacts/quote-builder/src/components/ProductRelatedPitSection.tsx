import type { QuoteGroup } from "../types";
import addPitData from "../data/add-pit-services2.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";

interface PitLineItem {
  id: string;
  name: string;
  duration: number;
}

interface PitCategory {
  id: string;
  name: string;
  lineItems: PitLineItem[];
}

const pitCategories = addPitData.categories as PitCategory[];

type ProductMapping =
  | { type: "category"; categoryIds: string[] }        // qty of all products in categories × duration
  | { type: "product"; productIds: string[] }           // fixed duration once if any product present
  | { type: "product-qty"; productIds: string[] };      // qty of matching products × duration

const PIT_ITEM_MAPPING: Record<string, ProductMapping> = {
  // Install — per quantity
  "ins-001": { type: "category",     categoryIds: ["terminals"] },
  "ins-002": { type: "category",     categoryIds: ["server", "serveradd"] },
  "ins-003": { type: "category",     categoryIds: ["tablet"] },
  "ins-004": { type: "category",     categoryIds: ["displays"] },
  "ins-005": { type: "category",     categoryIds: ["expo", "prep"] },
  "ins-006": { type: "category",     categoryIds: ["printers"] },
  "ins-007": { type: "category",     categoryIds: ["pinpads"] },
  "ins-008": { type: "product-qty",  productIds:  ["ha-001", "ha-002"] },
  // Staging — per quantity
  "sta-001": { type: "category",     categoryIds: ["terminals"] },
  "sta-002": { type: "category",     categoryIds: ["server", "serveradd"] },
  "sta-003": { type: "category",     categoryIds: ["tablet"] },
  "sta-004": { type: "category",     categoryIds: ["displays"] },
  "sta-005": { type: "category",     categoryIds: ["expo", "prep"] },
  "sta-006": { type: "category",     categoryIds: ["printers"] },
  "sta-007": { type: "category",     categoryIds: ["pinpads"] },
  "sta-008": { type: "product-qty",  productIds:  ["ha-001", "ha-002"] },
  // Programming — pro-001 and pro-002 are toggle-driven (see forcedItemIds below)
  "pro-003": { type: "product",      productIds: ["sa-001"] },
  "pro-004": { type: "product",      productIds: ["sa-002", "sa-003"] },
  "pro-005": { type: "product",      productIds: ["sa-005"] },
  "pro-006": { type: "product",      productIds: ["exp-001", "prp-001"] },
  "pro-007": { type: "product",      productIds: ["ha-001", "ha-002"] },
  "pro-008": { type: "product",      productIds: ["sa-007"] },
  // Training
  "tr-001": { type: "category",      categoryIds: ["pinpads"] },
  "tr-002": { type: "product",       productIds: ["sa-001"] },
  "tr-003": { type: "product",       productIds: ["sa-002", "sa-003"] },
  "tr-004": { type: "product",       productIds: ["sa-015", "sa-016", "sa-017"] },
  "tr-005": { type: "product",       productIds: ["exp-001", "prp-001"] },
  "tr-006": { type: "product",       productIds: ["ha-001", "ha-002"] },
};

const YES_NO_ITEM_MAP: Record<string, string[]> = {
  "connected-payments-yn": ["pro-001", "tr-001"],
  "online-ordering-yn": ["pro-002", "tr-004"],
};

function computeHours(
  item: PitLineItem,
  groups: QuoteGroup[]
): number {
  const mapping = PIT_ITEM_MAPPING[item.id];
  if (!mapping) return 0;

  if (mapping.type === "category") {
    let totalQty = 0;
    for (const group of groups) {
      if (mapping.categoryIds.includes(group.categoryId)) {
        for (const li of group.lineItems) {
          totalQty += li.quantity;
        }
      }
    }
    return totalQty * item.duration;
  }

  if (mapping.type === "product") {
    for (const group of groups) {
      for (const li of group.lineItems) {
        if (mapping.productIds.includes(li.productId)) {
          return item.duration;
        }
      }
    }
    return 0;
  }

  if (mapping.type === "product-qty") {
    let totalQty = 0;
    for (const group of groups) {
      for (const li of group.lineItems) {
        if (mapping.productIds.includes(li.productId)) {
          totalQty += li.quantity;
        }
      }
    }
    return totalQty * item.duration;
  }

  return 0;
}

interface CategoryTableProps {
  category: PitCategory;
  groups: QuoteGroup[];
  forcedItemIds: string[];
}

function CategoryTable({ category, groups, forcedItemIds }: CategoryTableProps) {
  const rows = category.lineItems
    .map((item) => {
      const forced = forcedItemIds.includes(item.id);
      const hours = forced ? item.duration : computeHours(item, groups);
      return { item, hours, price: hours * PIT_HOURLY_RATE };
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

interface Props {
  groups: QuoteGroup[];
  yesNoToggles: Record<string, boolean>;
}

export default function ProductRelatedPitSection({ groups, yesNoToggles }: Props) {
  const hasAnyProducts = groups.some((g) => g.lineItems.length > 0);

  const forcedItemIds = Object.entries(YES_NO_ITEM_MAP)
    .filter(([toggleId]) => yesNoToggles[toggleId])
    .flatMap(([, itemIds]) => itemIds);

  const hasContent =
    hasAnyProducts || forcedItemIds.length > 0;

  return (
    <div className="prpit-card">
      {!hasContent ? (
        <div className="prpit-placeholder">
          Add products to the Line Items section to see related PIT services.
        </div>
      ) : (
        <div className="prpit-grid">
          {pitCategories.map((cat) => (
            <CategoryTable
              key={cat.id}
              category={cat}
              groups={groups}
              forcedItemIds={forcedItemIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
