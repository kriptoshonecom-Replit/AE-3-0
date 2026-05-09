import { useEffect, useMemo, useRef, useState } from "react";
import type { Quote } from "../types";
import { formatCurrency, quoteTotal } from "../utils/calculations";
import { loadAllQuotes, deleteQuote } from "../utils/storage";
import { computeProductRelatedPitTotal } from "./ProductRelatedPitSection";
import pitData from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";

const DEFAULT_YES_NO: Record<string, boolean> = {
  "connected-payments-yn": false,
  "online-ordering-yn": false,
};

const DEFAULT_OPT_PROGRAMS: Record<string, boolean> = {
  "consumer-marketing": true,
  "insight-or-console": true,
  "aloha-api": true,
  kitchen: true,
  orderpay: true,
  "aloha-delivery": true,
};

function quoteGrandTotal(q: Quote): number {
  const productsTotal = quoteTotal(q);
  const pitCat = pitData.categories.find((c) => c.id === (q.meta.pitType ?? ""));
  const pitTotal = pitCat
    ? pitCat.lineItems.reduce(
        (s, i) => s + ("duration" in i ? (i.duration as number) : 0) * PIT_HOURLY_RATE,
        0,
      )
    : 0;
  const yesNoToggles = { ...DEFAULT_YES_NO, ...(q.meta.yesNoToggles ?? {}) };
  const optToggles = { ...DEFAULT_OPT_PROGRAMS, ...(q.meta.optionalProgramToggles ?? {}) };
  const productPitTotal = computeProductRelatedPitTotal(q.groups, yesNoToggles, optToggles);
  return productsTotal + pitTotal + productPitTotal;
}

function fmtShortDate(s: string | undefined | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  currentId: string;
  currentStatus?: "pass" | "fail" | null;
  onSelect: (quote: Quote) => void;
  onNew: () => void;
  onDuplicate: (quote: Quote) => void;
  refreshTrigger: number;
  userId: string;
  userFullName?: string;
  isAdmin?: boolean;
  apiBase?: string;
}

export default function QuoteList({
  currentId,
  currentStatus,
  onSelect,
  onNew,
  onDuplicate,
  refreshTrigger,
  userId,
  userFullName,
  apiBase,
}: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedOnce = useRef(false);

  // Fetch quotes from server whenever refreshTrigger changes.
  // Falls back to localStorage if the server is unreachable.
  useEffect(() => {
    if (!userId) return; // apiBase can be "" (relative URLs) — that is valid
    let cancelled = false;
    // Show spinner only on first load — subsequent refreshes update silently.
    if (!hasFetchedOnce.current) setLoading(true);

    fetch(`${apiBase}/api/quotes`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { quotes: Quote[] }) => {
        if (cancelled) return;
        const sorted = [...(data.quotes ?? [])].sort((a, b) =>
          (b.meta.updatedAt ?? "").localeCompare(a.meta.updatedAt ?? ""),
        );
        setQuotes(sorted);
        hasFetchedOnce.current = true;
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Server unreachable — show cached localStorage quotes
        const local = loadAllQuotes(userId).sort((a, b) =>
          (b.meta.updatedAt ?? "").localeCompare(a.meta.updatedAt ?? ""),
        );
        setQuotes(local);
        hasFetchedOnce.current = true;
        setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, apiBase, userId]);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      (quote) =>
        (quote.meta.quoteNumber || "").toLowerCase().includes(q) ||
        (quote.meta.customerName || "").toLowerCase().includes(q) ||
        (quote.meta.companyName || "").toLowerCase().includes(q) ||
        (quote.meta.creatorName || "").toLowerCase().includes(q),
    );
  }, [quotes, search]);

  async function handleDelete(q: Quote) {
    if (!window.confirm("Delete this quote?")) return;
    // Delete from server first — ensures server processes it before any
    // possible page refresh (prevents the quote from being restored on reload).
    try {
      // apiBase can be "" in production (relative URL) — fetch still works
      await fetch(`${apiBase ?? ""}/api/quotes/${q.meta.id}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      /* network error — remove locally anyway */
    }
    // Remove from localStorage cache
    deleteQuote(q.meta.id, userId);
    // Remove from local state immediately for instant UI feedback regardless of whether it's active
    setQuotes((prev) => prev.filter((sq) => sq.meta.id !== q.meta.id));
    // If the deleted quote was the one currently open, open a new blank quote
    if (q.meta.id === currentId) {
      onNew();
    }
  }

  return (
    <div className="quote-list">
      <div className="quote-list-header">
        <span className="ql-title">Saved Quotes</span>
        <button className="btn-new-quote" type="button" onClick={onNew}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 2v10M2 7h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          New
        </button>
      </div>

      <div className="ql-search-wrap">
        <svg className="ql-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          className="ql-search"
          placeholder="Search quotes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button type="button" className="ql-search-clear" onClick={() => setSearch("")}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {loading && (
        <p className="ql-empty" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="spinner" style={{ width: "12px", height: "12px" }} />
          Loading…
        </p>
      )}
      {!loading && quotes.length === 0 && (
        <p className="ql-empty" style={{ textAlign: "center", lineHeight: 1.5, padding: "12px 8px" }}>
          Your quote library is empty.<br />
          <span style={{ color: "var(--accent, #6c47ff)", fontWeight: 500 }}>Click + New to create your first quote.</span>
        </p>
      )}
      {!loading && quotes.length > 0 && filtered.length === 0 && (
        <p className="ql-empty">No quotes match &ldquo;{search}&rdquo;.</p>
      )}

      {!loading && (
        <div className="ql-items">
          {filtered.map((q) => {
            const creator = q.meta.creatorName || userFullName || "—";
            const updatedBy = q.meta.updatedByName;
            const isActive = q.meta.id === currentId;
            const passStatus: string | undefined =
              isActive && currentStatus != null
                ? currentStatus
                : (q.meta as unknown as Record<string, unknown>).passStatus as
                    | string
                    | undefined;

            return (
              <button
                key={q.meta.id}
                type="button"
                className={`ql-item ${q.meta.id === currentId ? "active" : ""}`}
                onClick={() => onSelect(q)}
              >
                {/* ── Row 1: title + total + delete ── */}
                <div className="ql-item-top">
                  <span className="ql-item-title">
                    {q.meta.quoteNumber || "Untitled Quote"}
                  </span>
                  <div className="ql-item-top-right">
                    <span className="ql-item-total">{formatCurrency(quoteGrandTotal(q))}</span>
                    <button
                      type="button"
                      className="ql-duplicate"
                      title="Duplicate quote"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(q);
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                        <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M3 11V3h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="ql-delete"
                      title="Delete quote"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(q);
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2 2l10 10M12 2L2 12"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── Row 2: company / customer ── */}
                {(q.meta.companyName || q.meta.customerName) && (
                  <span className="ql-item-company">
                    {q.meta.companyName || q.meta.customerName}
                  </span>
                )}

                {/* ── Row 3: creator + created date ── */}
                <div className="ql-item-meta-row">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.1" />
                    <path
                      d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="ql-meta-val">{creator}</span>
                  <span className="ql-meta-sep">·</span>
                  <span className="ql-meta-val">{fmtShortDate(q.meta.createdAt)}</span>
                </div>

                {/* ── Row 4: updated info ── */}
                <div className="ql-item-meta-row">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M10 6A4 4 0 1 1 6 2"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10 2v3H7"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="ql-meta-val">{fmtShortDate(q.meta.updatedAt)}</span>
                  {updatedBy && (
                    <>
                      <span className="ql-meta-sep">·</span>
                      <span className="ql-meta-val ql-meta-admin">by {updatedBy}</span>
                    </>
                  )}
                </div>

                {/* ── Row 5: pass/fail badge ── */}
                {passStatus ? (
                  <div className="ql-item-status-row">
                    <span className={`ql-status-badge ql-status-${passStatus}`}>
                      {passStatus === "pass" ? "PASS" : "FAIL"}
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
