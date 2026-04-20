import type { QuoteGroup } from "../types";

export const LICENSE_IDS = ["co-001", "co-002"] as const;
export const TERMINAL_IDS = ["tm-001", "tm-002"] as const;
export const TABLET_IDS = ["ta-001", "ta-002", "ta-003"] as const;
export const DEVICE_IDS: readonly string[] = [...TERMINAL_IDS, ...TABLET_IDS];

/** Sum of all terminal + tablet quantities across all groups */
export function computeTotalDeviceCount(groups: QuoteGroup[]): number {
  let total = 0;
  for (const group of groups) {
    for (const item of group.lineItems) {
      if (DEVICE_IDS.includes(item.productId)) {
        total += item.quantity;
      }
    }
  }
  return total;
}

/** Find the first license line item (co-001 or co-002) across all groups */
export function findLicenseItem(groups: QuoteGroup[]): {
  groupIdx: number;
  itemIdx: number;
  productId: string;
  currentQty: number;
} | null {
  for (let gi = 0; gi < groups.length; gi++) {
    for (let li = 0; li < groups[gi].lineItems.length; li++) {
      const item = groups[gi].lineItems[li];
      if ((LICENSE_IDS as readonly string[]).includes(item.productId)) {
        return {
          groupIdx: gi,
          itemIdx: li,
          productId: item.productId,
          currentQty: item.quantity,
        };
      }
    }
  }
  return null;
}

/**
 * Returns true if the change between oldGroup and newGroup was a quantity
 * change on a terminal or tablet item (not just a product selection).
 */
export function deviceQtyChanged(
  oldGroup: QuoteGroup,
  newGroup: QuoteGroup,
): boolean {
  for (const newItem of newGroup.lineItems) {
    if (!DEVICE_IDS.includes(newItem.productId)) continue;
    const oldItem = oldGroup.lineItems.find((i) => i.id === newItem.id);
    if (oldItem && oldItem.quantity !== newItem.quantity) return true;
  }
  return false;
}

/**
 * Returns true if a terminal/tablet product was newly assigned to a line item
 * (productId changed from a non-device value to a device ID).
 */
export function deviceProductSelected(
  oldGroup: QuoteGroup,
  newGroup: QuoteGroup,
): boolean {
  for (const newItem of newGroup.lineItems) {
    if (!DEVICE_IDS.includes(newItem.productId)) continue;
    const oldItem = oldGroup.lineItems.find((i) => i.id === newItem.id);
    const wasDevice = oldItem ? DEVICE_IDS.includes(oldItem.productId) : false;
    if (!wasDevice) return true;
  }
  return false;
}
