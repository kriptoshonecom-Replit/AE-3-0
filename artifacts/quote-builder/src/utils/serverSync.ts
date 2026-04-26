import type { Quote } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

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

export async function fetchServerQuotes(): Promise<Quote[]> {
  try {
    const res = await fetch(`${API_BASE}/api/quotes`, { credentials: "include" });
    if (!res.ok) return [];
    const data = (await res.json()) as { quotes: Quote[] };
    return Array.isArray(data.quotes) ? data.quotes : [];
  } catch {
    return [];
  }
}
