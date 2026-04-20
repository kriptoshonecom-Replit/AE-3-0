export interface ProductItem {
  id: string;
  name: string;
  price: number;
  type?: "info" | "warning";
  text?: string;
  produration?: number;
  traduration?: number;
  instaduration?: number;
  stageduration?: number;
  sitecopyproduration?: number;
  sitecopytradiration?: number;
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
  salesRep: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  validUntil: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  discount: number;
  tax: number;
  pitType?: string;
  yesNoToggles?: Record<string, boolean>;
  optionalProgramToggles?: Record<string, boolean>;
  aeCurrentMonthlySpend?: string;
  aeCurrentVoyixPaySpend?: string;
  existingHeadlineRate?: string;
  existingInterchangeRate?: string;
  heatmapToggles?: Record<string, boolean>;
  legacyToggles?: Record<string, boolean>;
  annualStoreRevenue?: string;
  averageTicketAmount?: string;
  contractBuyOut?: boolean;
  costOfBuyOut?: string;
  numberOfSites?: string;
  basisPoint?: string;
  voyixPayTransactionFee?: string;
  paymentsSpecialist?: string;
  requestedSubscriptionAmount?: string;
  requestedUpfrontAmount?: string;
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
