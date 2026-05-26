import type { Quote } from "../types";

const storageKey  = (userId: string) => `quote_builder_quotes__${userId}`;
const activeKey   = (userId: string) => `quote_builder_active__${userId}`;
const syncedKey   = (userId: string) => `cpq_synced_ids__${userId}`;

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

// ── Server-sync tracking ─────────────────────────────────────────────────────
//
// We track which quote IDs have been confirmed by the server so we can
// distinguish two cases at startup:
//
//  (A) Quote in localStorage + never confirmed by server
//      → Genuinely unsynced (offline creation, pre-server-sync migration)
//      → Re-upload to server on startup
//
//  (B) Quote in localStorage + previously confirmed by server, but now missing
//      → Was deleted by an admin on another device
//      → Remove from localStorage; do NOT re-upload
//
// The set is populated eagerly from serverQuotes on every successful startup
// fetch, and updated whenever the debounced autosave gets a 200 back.

export function getSyncedQuoteIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(syncedKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function markQuotesSynced(userId: string, ids: string[]): void {
  if (!ids.length) return;
  const existing = getSyncedQuoteIds(userId);
  for (const id of ids) existing.add(id);
  localStorage.setItem(syncedKey(userId), JSON.stringify([...existing]));
}

export function pruneSyncedIds(userId: string, ids: string[]): void {
  if (!ids.length) return;
  const existing = getSyncedQuoteIds(userId);
  for (const id of ids) existing.delete(id);
  localStorage.setItem(syncedKey(userId), JSON.stringify([...existing]));
}

// ── Pending open (Quote Library → Builder navigation) ────────────────────────

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
