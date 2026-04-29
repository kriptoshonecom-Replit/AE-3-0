import type { Quote } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let adminSyncTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced save — waits 1.5 s after the last call before pushing to the server.
 * Ideal for autosave while the user is actively editing.
 * `onSynced` is called once the server confirms the save, so callers can
 * trigger a sidebar refresh at that point.
 */
export function syncQuoteToServer(quote: Quote, onSynced?: () => void): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await fetch(`${API_BASE}/api/quotes/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quote }),
      });
      onSynced?.();
    } catch {
      /* network error — sidebar will refresh on next successful save */
    }
  }, 1500);
}

/**
 * Immediate save — no debounce, returns a Promise that resolves when the
 * server has confirmed. Use this for new quote creation so the sidebar
 * shows the new quote right away without waiting 1.5 s.
 */
export async function saveQuoteToServerNow(quote: Quote): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/quotes/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quote }),
    });
  } catch {
    /* ignore — localStorage already has the quote as a cache */
  }
}

/**
 * Admin editing another user's quote — routes through the admin endpoint
 * so that updatedByName is attributed correctly and the original owner's
 * record is updated.
 */
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
 * Used at startup to migrate local-only quotes (created before server sync
 * was in place) so they appear in the server and the sidebar.
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
 * Returns `null` when the fetch fails — callers must treat `null` as
 * "server unreachable; do not alter local data".
 * Returns an empty array only when the server confirms no quotes exist.
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
