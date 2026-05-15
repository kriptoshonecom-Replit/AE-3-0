import type { Quote } from "../types";

const storageKey = (userId: string) => `quote_builder_quotes__${userId}`;
const activeKey  = (userId: string) => `quote_builder_active__${userId}`;

export function saveQuote(quote: Quote, userId: string): void {
  const all = loadAllQuotes(userId);
  const idx = all.findIndex((q) => q.meta.id === quote.meta.id);
  if (idx >= 0) {
    all[idx] = quote;
  } else {
    all.push(quote);
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(all));
  localStorage.setItem(activeKey(userId), quote.meta.id);
}

export function loadAllQuotes(userId: string): Quote[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadQuote(id: string, userId: string): Quote | null {
  const all = loadAllQuotes(userId);
  return all.find((q) => q.meta.id === id) ?? null;
}

export function deleteQuote(id: string, userId: string): void {
  const all = loadAllQuotes(userId).filter((q) => q.meta.id !== id);
  localStorage.setItem(storageKey(userId), JSON.stringify(all));
}

export function getActiveQuoteId(userId: string): string | null {
  return localStorage.getItem(activeKey(userId));
}

export function setActiveQuoteId(id: string, userId: string): void {
  localStorage.setItem(activeKey(userId), id);
}

const PENDING_OPEN_KEY = "cpq_pending_open_quote";

export function setPendingOpenQuote(quote: Quote, ownerId: string): void {
  localStorage.setItem(PENDING_OPEN_KEY, JSON.stringify({ quote, ownerId }));
}

export function consumePendingOpenQuote(): { quote: Quote; ownerId: string } | null {
  const raw = localStorage.getItem(PENDING_OPEN_KEY);
  if (!raw) return null;
  localStorage.removeItem(PENDING_OPEN_KEY);
  try {
    return JSON.parse(raw) as { quote: Quote; ownerId: string };
  } catch {
    return null;
  }
}
