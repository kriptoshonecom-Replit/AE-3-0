export interface ProductItem {
  id: string;
  name: string;
  price: number;
  type?: "info" | "warning" | "product";
  text?: string;
  image?: string;
  produration?: number;
  traduration?: number;
  instaduration?: number;
  stageduration?: number;
  sitecopyproduration?: number;
  sitecopytradiration?: number;
  /** Quantity Limit Toggle — when true, quantity is locked to 1 */
  qlt?: boolean;
  /**
   * Exclusive Group — products sharing the same non-empty string are mutually
   * exclusive: selecting one hides all others in the same group from the dropdown.
   * Set from the Products Config admin page.
   */
  exclusiveGroup?: string;
  /**
   * Restocking Fee (RF) — dollar amount charged per unit when a product is
   * returned or restocked. Carried on the product definition and used in
   * amendment delta calculations.
   *
   * NOTE: RF display and calculation logic is not yet implemented.
   *       This field is reserved for a future update.
   */
  rf?: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  items: ProductItem[];
}

export interface ProductCatalog {
  categories: ProductCategory[];
}

export interface QuoteLineItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  note?: string;
}

export interface QuoteGroup {
  id: string;
  categoryId: string;
  categoryName: string;
  lineItems: QuoteLineItem[];
  isOpen: boolean;
}

export interface QuoteMeta {
  id: string;
  quoteNumber: string;
  oppNumber: string;
  mcn?: string;
  fua?: number;
  dba?: string;
  salesRep: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerPosition?: string;
  validUntil: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  discount: number;
  tax: number;
  pitType?: string;
  recurringPit?: boolean;
  yesNoToggles?: Record<string, boolean>;
  optionalProgramToggles?: Record<string, boolean>;
  aeCurrentMonthlySpend?: string;
  aeCurrentVoyixPaySpend?: string;
  existingHeadlineRate?: string;
  existingInterchangeRate?: string;
  heatmapToggles?: Record<string, boolean>;
  legacyToggles?: Record<string, boolean>;
  legacyQuantities?: Record<string, number>;
  annualStoreRevenue?: string;
  averageTicketAmount?: string;
  contractBuyOut?: boolean;
  ncrPay?: boolean;
  costOfBuyOut?: string;
  numberOfSites?: string;
  basisPoint?: string;
  voyixPayTransactionFee?: string;
  paymentsSpecialist?: string;
  voyixPayYesEnabled?: boolean;
  voyixPayYesRate?: string;
  voyixPayNoEnabled?: boolean;
  voyixPayNoRate?: string;
  requestedSubscriptionAmount?: string;
  requestedUpfrontAmount?: string;
  creatorName?: string;
  updatedByName?: string;
  passStatus?: "pass" | "fail";
  addressLine?: string;
  addressName?: string;
  addressNumber?: string;
  addressCity?: string;
  addressState?: string;
  zipCode?: string;
  addressCountry?: string;
  sameForBilling?: boolean;
  billingAddressLine?: string;
  billingAddressName?: string;
  billingAddressNumber?: string;
  billingAddressCity?: string;
  billingAddressState?: string;
  billingZipCode?: string;
  billingAddressCountry?: string;
  businessOperation?: string;
}

export interface PitLineItem {
  id: string;
  name: string;
  duration: number;
}

export interface PitCategory {
  id: string;
  name: string;
  lineItems: PitLineItem[];
}

export interface PitCatalog {
  categories: PitCategory[];
}

export interface Quote {
  meta: QuoteMeta;
  groups: QuoteGroup[];
}
