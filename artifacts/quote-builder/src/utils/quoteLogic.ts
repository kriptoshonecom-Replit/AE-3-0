// ─────────────────────────────────────────────────────────────────────────────
// quoteLogic.ts
// Custom business logic: price calculations, restrictions, and rules.
// ─────────────────────────────────────────────────────────────────────────────
// ── Mutual Exclusion Restriction ──────────────────────────────────────────────
// co-001 and co-002 cannot both be selected in the same group at the same time.

const MUTUALLY_EXCLUSIVE_IDS: string[] = ["co-001", "co-002"];

/**
 * Given the product IDs already used in other rows of a group,
 * returns any additional IDs that should be blocked for the current row.
 * If one exclusive item is already taken, all others in the set are blocked.
 */
export function getAdditionalExcludedIds(usedProductIds: string[]): string[] {
  const takenExclusive = usedProductIds.find((id) => MUTUALLY_EXCLUSIVE_IDS.includes(id));
  if (takenExclusive) {
    return MUTUALLY_EXCLUSIVE_IDS.filter((id) => id !== takenExclusive);
  }
  return [];
}


// ── Tiered Pricing ────────────────────────────────────────────────────────────
// co-001 and co-002: first unit at full unit price, every additional unit at $30.

const TIERED_ITEM_IDS: string[] = ["co-001", "co-002"];
const TIERED_ADDITIONAL_UNIT_PRICE = 30;

/**
 * Computes the line item total, applying tiered pricing where applicable.
 *   - Tiered items: total = unitPrice + (qty - 1) × $30
 *   - All other items: total = unitPrice × qty
 */
export function computeLineItemTotal(
  productId: string,
  unitPrice: number,
  quantity: number
): number {
  if (TIERED_ITEM_IDS.includes(productId) && quantity > 0) {
    return unitPrice + Math.max(0, quantity - 1) * TIERED_ADDITIONAL_UNIT_PRICE;
  }
  return unitPrice * quantity;
}

/**
 * Returns true if this product uses tiered pricing.
 * Useful for showing a visual hint in the UI.
 */
export function isTieredItem(productId: string): boolean {
  return TIERED_ITEM_IDS.includes(productId);
}


