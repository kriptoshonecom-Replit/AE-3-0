import type { Quote, QuoteGroup } from "../types";
import { computeLineItemTotal } from "./quoteLogic";

export function groupSubtotal(group: QuoteGroup): number {
  return group.lineItems.reduce(
    (sum, item) => sum + computeLineItemTotal(item.productId, item.unitPrice, item.quantity),
    0
  );
}

export function quoteSubtotal(quote: Quote): number {
  return quote.groups.reduce((sum, g) => sum + groupSubtotal(g), 0);
}

export function quoteDiscount(quote: Quote): number {
  return quoteSubtotal(quote) * (quote.meta.discount / 100);
}

export function quoteTaxBase(quote: Quote): number {
  return quoteSubtotal(quote) - quoteDiscount(quote);
}

export function quoteTax(quote: Quote): number {
  return quoteTaxBase(quote) * (quote.meta.tax / 100);
}

export function quoteTotal(quote: Quote): number {
  return quoteTaxBase(quote) + quoteTax(quote);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function thirtyDaysOut(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}
