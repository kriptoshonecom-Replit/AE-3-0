// ─────────────────────────────────────────────────────────────────────────────
// quoteLogic.ts
// Custom business logic: price calculations, restrictions, and rules.
// ─────────────────────────────────────────────────────────────────────────────
import type { QuoteGroup } from "../types";


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
  quantity: number,
  additionalUnitPrice: number = TIERED_ADDITIONAL_UNIT_PRICE
): number {
  if (TIERED_ITEM_IDS.includes(productId) && quantity > 0) {
    return unitPrice + Math.max(0, quantity - 1) * additionalUnitPrice;
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


// ── Tablet Equipment Reminder ─────────────────────────────────────────────────
// When ta-001, ta-002, or ta-003 are selected, show an info popup reminding
// the user to add supporting accessories separately.

const TABLET_INFO_IDS: string[] = ["ta-001", "ta-002", "ta-003"];

export function isTabletItem(productId: string): boolean {
  return TABLET_INFO_IDS.includes(productId);
}


// ── Pin Pad ↔ Terminal Count Check ────────────────────────────────────────────
// pi-001, pi-002, pi-005, pi-006, pi-008, pi-009 quantities should match
// the total terminal/device count (same reference as TERMINAL_SYNC_IDS).

const PIN_PAD_IDS: string[] = ["pi-001", "pi-002", "pi-005", "pi-006", "pi-008", "pi-009"];

export interface PinPadSyncCheck {
  needed: boolean;
  deviceCount: number;
  pinPadCount: number;
}

/**
 * Checks whether the total pin pad quantity matches the total device (terminal) count.
 */
export function getPinPadSyncCheck(groups: QuoteGroup[]): PinPadSyncCheck {
  const terminalSyncIds = ["tm-001", "tm-002"];
  let deviceCount = 0;
  let pinPadCount = 0;
  let hasPinPad = false;
  let hasDevice = false;

  for (const group of groups) {
    for (const item of group.lineItems) {
      if (terminalSyncIds.includes(item.productId)) {
        deviceCount += item.quantity;
        hasDevice = true;
      }
      if (PIN_PAD_IDS.includes(item.productId)) {
        pinPadCount += item.quantity;
        hasPinPad = true;
      }
    }
  }

  return {
    needed: hasPinPad && hasDevice && pinPadCount !== deviceCount,
    deviceCount,
    pinPadCount,
  };
}

/**
 * Returns a new groups array where all pin pad item quantities are set
 * to match the total terminal/device count, distributed evenly across
 * all pin pad items (remainder goes to the first).
 */
export function applyPinPadSync(groups: QuoteGroup[]): QuoteGroup[] {
  const terminalSyncIds = ["tm-001", "tm-002"];
  const deviceCount = groups
    .flatMap((g) => g.lineItems)
    .filter((i) => terminalSyncIds.includes(i.productId))
    .reduce((sum, i) => sum + i.quantity, 0);

  const pinPadItems = groups
    .flatMap((g) => g.lineItems)
    .filter((i) => PIN_PAD_IDS.includes(i.productId));

  if (pinPadItems.length === 0 || deviceCount === 0) return groups;

  const perItem = Math.floor(deviceCount / pinPadItems.length);
  const remainder = deviceCount % pinPadItems.length;
  let pinPadIdx = 0;

  return groups.map((g) => ({
    ...g,
    lineItems: g.lineItems.map((item) => {
      if (!PIN_PAD_IDS.includes(item.productId)) return item;
      const qty = perItem + (pinPadIdx === 0 ? remainder : 0);
      pinPadIdx++;
      return { ...item, quantity: qty };
    }),
  }));
}


// ── Quantity Sync: Core ↔ Terminals ───────────────────────────────────────────
// Core (co-001/co-002) quantity must match the total of all terminal/tablet items
// (tm-001, tm-002, ta-001, ta-002, ta-003).

const CORE_SYNC_IDS: string[] = ["co-001", "co-002"];
const TERMINAL_SYNC_IDS: string[] = ["tm-001", "tm-002", "ta-001", "ta-002", "ta-003"];

export interface QtySyncCheck {
  needed: boolean;
  coreQty: number;
  terminalQty: number;
}

/**
 * Scans all groups and returns whether there is a quantity mismatch
 * between any Core item (co-001/co-002) and any Terminal item (tm-001/tm-002).
 */
export function getQtySyncCheck(groups: QuoteGroup[]): QtySyncCheck {
  let coreQty = 0;
  let terminalQty = 0;
  let hasCore = false;
  let hasTerminal = false;

  for (const group of groups) {
    for (const item of group.lineItems) {
      if (CORE_SYNC_IDS.includes(item.productId)) {
        coreQty += item.quantity;
        hasCore = true;
      }
      if (TERMINAL_SYNC_IDS.includes(item.productId)) {
        terminalQty += item.quantity;
        hasTerminal = true;
      }
    }
  }

  return {
    needed: hasCore && hasTerminal && coreQty !== terminalQty,
    coreQty,
    terminalQty,
  };
}

/**
 * Returns a new groups array where Core item quantities are adjusted
 * to match the total Terminal quantity. The terminal total is distributed
 * evenly across all Core items; any remainder goes to the first Core item.
 */
export function applyQtySync(groups: QuoteGroup[]): QuoteGroup[] {
  const terminalQty = groups
    .flatMap((g) => g.lineItems)
    .filter((i) => TERMINAL_SYNC_IDS.includes(i.productId))
    .reduce((sum, i) => sum + i.quantity, 0);

  const coreItems = groups
    .flatMap((g) => g.lineItems)
    .filter((i) => CORE_SYNC_IDS.includes(i.productId));

  if (coreItems.length === 0 || terminalQty === 0) return groups;

  // Distribute terminal total evenly across core items; remainder goes to the first
  const perItem = Math.floor(terminalQty / coreItems.length);
  const remainder = terminalQty % coreItems.length;
  let coreIdx = 0;

  return groups.map((g) => ({
    ...g,
    lineItems: g.lineItems.map((item) => {
      if (!CORE_SYNC_IDS.includes(item.productId)) return item;
      const qty = perItem + (coreIdx === 0 ? remainder : 0);
      coreIdx++;
      return { ...item, quantity: qty };
    }),
  }));
}
