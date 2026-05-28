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

interface AdminQuoteRow {
  id: string;
  data: Quote;
  quoteNumber: string | null;
  companyName: string | null;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
  passStatus: string | null;
  userId: string;
  creatorName: string | null;
  creatorEmail: string | null;
}

interface Props {
  currentId: string;
  currentStatus?: "pass" | "fail" | null;
  onSelect: (quote: Quote) => void;
  onNew: () => void;
  onDuplicate?: (quote: Quote) => Promise<void>;
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
  isAdmin,
  apiBase,
}: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [adminRows, setAdminRows] = useState<AdminQuoteRow[]>([]);
  const [viewMode, setViewMode] = useState<"mine" | "all">("mine");
  const [loading, setLoading] = useState(true);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [amendCounts, setAmendCounts] = useState<Record<string, number>>({});
  const hasFetchedOnce = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    if (!hasFetchedOnce.current) setLoading(true);

    if (isAdmin && viewMode === "all") {
      Promise.all([
        fetch(`${apiBase}/api/admin/quotes`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${apiBase}/api/admin/amendments/counts`, { credentials: "include" })
          .then((r) => r.ok ? r.json() : { counts: {} }),
      ])
        .then(([quotesData, amendData]: [{ quotes: AdminQuoteRow[] }, { counts: Record<string, number> }]) => {
          if (cancelled) return;
          const sorted = [...(quotesData.quotes ?? [])].sort((a, b) =>
            (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
          );
          setAdminRows(sorted);
          setAmendCounts(amendData.counts ?? {});
          hasFetchedOnce.current = true;
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setAdminRows([]);
          hasFetchedOnce.current = true;
          setLoading(false);
        });
    } else {
      Promise.all([
        fetch(`${apiBase}/api/quotes`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${apiBase}/api/amendments`, { credentials: "include" })
          .then((r) => r.ok ? r.json() : { amendments: [] }),
      ])
        .then(([quotesData, amendData]: [{ quotes: Quote[] }, { amendments: { originalQuoteId: string }[] }]) => {
          if (cancelled) return;
          const sorted = [...(quotesData.quotes ?? [])].sort((a, b) =>
            (b.meta.updatedAt ?? "").localeCompare(a.meta.updatedAt ?? ""),
          );
          setQuotes(sorted);
          const counts: Record<string, number> = {};
          for (const a of amendData.amendments ?? []) {
            counts[a.originalQuoteId] = (counts[a.originalQuoteId] ?? 0) + 1;
          }
          setAmendCounts(counts);
          hasFetchedOnce.current = true;
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          const local = loadAllQuotes(userId).sort((a, b) =>
            (b.meta.updatedAt ?? "").localeCompare(a.meta.updatedAt ?? ""),
          );
          setQuotes(local);
          hasFetchedOnce.current = true;
          setLoading(false);
        });
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, apiBase, userId, viewMode, isAdmin]);

  // Reset hasFetchedOnce when switching view modes so the spinner shows
  function switchMode(mode: "mine" | "all") {
    hasFetchedOnce.current = false;
    setLoading(true);
    setViewMode(mode);
  }

  const [search, setSearch] = useState("");

  const filteredMine = useMemo(() => {
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

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return adminRows;
    return adminRows.filter(
      (row) =>
        (row.quoteNumber || "").toLowerCase().includes(q) ||
        (row.customerName || "").toLowerCase().includes(q) ||
        (row.companyName || "").toLowerCase().includes(q) ||
        (row.creatorName || "").toLowerCase().includes(q) ||
        (row.creatorEmail || "").toLowerCase().includes(q),
    );
  }, [adminRows, search]);

  async function handleDelete(q: Quote) {
    if (!window.confirm("Delete this quote?")) return;
    try {
      const endpoint =
        isAdmin && viewMode === "all"
          ? `${apiBase ?? ""}/api/admin/quotes/${q.meta.id}`
          : `${apiBase ?? ""}/api/quotes/${q.meta.id}`;
      await fetch(endpoint, { method: "DELETE", credentials: "include" });
    } catch {
      /* network error — remove locally anyway */
    }
    if (viewMode === "all") {
      setAdminRows((prev) => prev.filter((r) => r.id !== q.meta.id));
    } else {
      deleteQuote(q.meta.id, userId);
      setQuotes((prev) => prev.filter((sq) => sq.meta.id !== q.meta.id));
    }
    if (q.meta.id === currentId) {
      onNew();
    }
  }

  const isAllMode = isAdmin && viewMode === "all";
  const isEmpty = isAllMode ? adminRows.length === 0 : quotes.length === 0;
  const filteredItems = isAllMode ? filteredAll : filteredMine;

  return (
    <div className="quote-list">
      <div className="quote-list-header">
        <span className="ql-title">{isAllMode ? "All Quotes" : "Saved Quotes"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isAdmin && (
            <div className="ql-view-toggle">
              <button
                type="button"
                className={`ql-toggle-btn${viewMode === "mine" ? " active" : ""}`}
                onClick={() => switchMode("mine")}
                title="My quotes"
              >
                Mine
              </button>
              <button
                type="button"
                className={`ql-toggle-btn${viewMode === "all" ? " active" : ""}`}
                onClick={() => switchMode("all")}
                title="All users' quotes"
              >
                All
              </button>
            </div>
          )}
          {!isAllMode && (
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
          )}
        </div>
      </div>

      <div className="ql-search-wrap">
        <svg className="ql-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          className="ql-search"
          placeholder={isAllMode ? "Search all quotes…" : "Search quotes…"}
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
      {!loading && isEmpty && (
        <p className="ql-empty" style={{ textAlign: "center", lineHeight: 1.5, padding: "12px 8px" }}>
          {isAllMode ? "No quotes found." : (
            <>Your quote library is empty.<br />
            <span style={{ color: "var(--accent, #6c47ff)", fontWeight: 500 }}>Click + New to create your first quote.</span></>
          )}
        </p>
      )}
      {!loading && !isEmpty && filteredItems.length === 0 && (
        <p className="ql-empty">No quotes match &ldquo;{search}&rdquo;.</p>
      )}

      {!loading && (
        <div className="ql-items">
          {isAllMode
            ? filteredAll.map((row) => {
                const q = row.data;
                const isActive = q.meta.id === currentId;
                const passStatus: string | undefined =
                  isActive && currentStatus != null
                    ? currentStatus
                    : row.passStatus ?? undefined;

                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`ql-item${isActive ? " active" : ""}`}
                    onClick={() => onSelect(q)}
                  >
                    <div className="ql-item-top">
                      <span className="ql-item-title">
                        {row.quoteNumber || q.meta.quoteNumber || "Untitled Quote"}
                      </span>
                      <div className="ql-item-top-right">
                        <span className="ql-item-total">{formatCurrency(quoteGrandTotal(q))}</span>
                        {onDuplicate && (
                          <button
                            type="button"
                            className="ql-duplicate"
                            title="Duplicate quote"
                            disabled={duplicatingId === q.meta.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDuplicatingId(q.meta.id);
                              onDuplicate(q).finally(() => setDuplicatingId(null));
                            }}
                          >
                            {duplicatingId === q.meta.id ? (
                              <span className="spinner" style={{ width: 10, height: 10 }} />
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                                <rect x="4" y="4" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M2 10V2h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        )}
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
                            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {(row.companyName || row.customerName) && (
                      <span className="ql-item-company">
                        {row.companyName || row.customerName}
                      </span>
                    )}

                    <div className="ql-item-meta-row">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.1" />
                        <path d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      </svg>
                      <span className="ql-meta-val ql-meta-creator">{row.creatorName || "—"}</span>
                      <span className="ql-meta-sep">·</span>
                      <span className="ql-meta-val">{fmtShortDate(row.createdAt)}</span>
                    </div>

                    <div className="ql-item-meta-row">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M10 6A4 4 0 1 1 6 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                        <path d="M10 2v3H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="ql-meta-val">{fmtShortDate(row.updatedAt)}</span>
                      {row.updatedByName && (
                        <>
                          <span className="ql-meta-sep">·</span>
                          <span className="ql-meta-val ql-meta-admin">by {row.updatedByName}</span>
                        </>
                      )}
                    </div>

                    {(passStatus || amendCounts[row.id] > 0) ? (
                      <div className="ql-item-status-row">
                        <div>
                          {amendCounts[row.id] > 0 && (
                            <span className="ql-amend-badge" title={`${amendCounts[row.id]} amendment${amendCounts[row.id] !== 1 ? "s" : ""}`}>
                              A
                            </span>
                          )}
                        </div>
                        <div>
                          {passStatus && (
                            <span className={`ql-status-badge ql-status-${passStatus}`}>
                              {passStatus === "pass" ? "PASS" : "FAIL"}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </button>
                );
              })
            : filteredMine.map((q) => {
                const creator = q.meta.creatorName || userFullName || "—";
                const updatedBy = q.meta.updatedByName;
                const isActive = q.meta.id === currentId;
                const passStatus: string | undefined =
                  isActive && currentStatus != null
                    ? currentStatus
                    : (q.meta as unknown as Record<string, unknown>).passStatus as string | undefined;

                return (
                  <button
                    key={q.meta.id}
                    type="button"
                    className={`ql-item ${q.meta.id === currentId ? "active" : ""}`}
                    onClick={() => onSelect(q)}
                  >
                    <div className="ql-item-top">
                      <span className="ql-item-title">
                        {q.meta.quoteNumber || "Untitled Quote"}
                      </span>
                      <div className="ql-item-top-right">
                        <span className="ql-item-total">{formatCurrency(quoteGrandTotal(q))}</span>
                        {onDuplicate && (
                          <button
                            type="button"
                            className="ql-duplicate"
                            title="Duplicate quote"
                            disabled={duplicatingId === q.meta.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDuplicatingId(q.meta.id);
                              onDuplicate(q).finally(() => setDuplicatingId(null));
                            }}
                          >
                            {duplicatingId === q.meta.id ? (
                              <span className="spinner" style={{ width: 10, height: 10 }} />
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                                <rect x="4" y="4" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M2 10V2h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        )}
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

                    {(q.meta.companyName || q.meta.customerName) && (
                      <span className="ql-item-company">
                        {q.meta.companyName || q.meta.customerName}
                      </span>
                    )}

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

                    {(passStatus || amendCounts[q.meta.id] > 0) ? (
                      <div className="ql-item-status-row">
                        <div>
                          {amendCounts[q.meta.id] > 0 && (
                            <span className="ql-amend-badge" title={`${amendCounts[q.meta.id]} amendment${amendCounts[q.meta.id] !== 1 ? "s" : ""}`}>
                              A
                            </span>
                          )}
                        </div>
                        <div>
                          {passStatus && (
                            <span className={`ql-status-badge ql-status-${passStatus}`}>
                              {passStatus === "pass" ? "PASS" : "FAIL"}
                            </span>
                          )}
                        </div>
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
