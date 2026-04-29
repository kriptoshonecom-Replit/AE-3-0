import type { Quote } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let adminSyncTimeout: ReturnType<typeof setTimeout> | null = null;

export function syncQuoteToServer(quote: Quote): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await fetch(`${API_BASE}/api/quotes/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quote }),
      });
    } catch {
      /* fire-and-forget: silently ignore network errors */
    }
  }, 1500);
}

/** Called when an admin saves another user's quote — routes through the admin endpoint
 *  so that updatedByName is attributed correctly and the original owner's record is updated. */
export function adminSaveQuoteToServer(quoteId: string, quote: Quote): void {
  if (adminSyncTimeout) clearTimeout(adminSyncTimeout);
  adminSyncTimeout = setTimeout(async () => {
    try {
      await fetch(`${API_BASE}/api/admin/quotes/${quoteId}/full`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quote }),
      });
    } catch {
      /* fire-and-forget */
    }
  }, 1500);
}

/**
 * Uploads an array of quotes to the server sequentially.
 * Used at startup to migrate local-only quotes so they become visible to
 * admin users. Fire-and-forget per quote; errors are silently ignored.
 */
export async function bulkUploadQuotesToServer(quotes: Quote[]): Promise<void> {
  for (const quote of quotes) {
    try {
      await fetch(`${API_BASE}/api/quotes/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quote }),
      });
    } catch {
      /* ignore individual failures */
    }
  }
}

/**
 * Returns the user's server-side quotes.
 * Returns `null` when the fetch fails or returns a non-OK status — callers
 * must treat `null` as "unknown, do not delete local data".
 * Returns an empty array only when the server confirms there are no quotes.
 */
export async function fetchServerQuotes(): Promise<Quote[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/quotes`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { quotes: Quote[] };
    return Array.isArray(data.quotes) ? data.quotes : [];
  } catch {
    return null;
  }
}
