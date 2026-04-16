import { useMemo, useState } from "react";
import type { Quote } from "../types";
import { formatCurrency, quoteTotal } from "../utils/calculations";
import { loadAllQuotes, deleteQuote } from "../utils/storage";

interface Props {
  currentId: string;
  onSelect: (quote: Quote) => void;
  onNew: () => void;
  refreshTrigger: number;
  userId: string;
}

export default function QuoteList({ currentId, onSelect, onNew, refreshTrigger, userId }: Props) {
  const quotes = useMemo(() => loadAllQuotes(userId), [refreshTrigger, userId]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      (quote) =>
        (quote.meta.quoteNumber || "").toLowerCase().includes(q) ||
        (quote.meta.customerName || "").toLowerCase().includes(q)
    );
  }, [quotes, search]);

  return (
    <div className="quote-list">
      <div className="quote-list-header">
        <span className="ql-title">Saved Quotes</span>
        <button className="btn-new-quote" type="button" onClick={onNew}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {quotes.length === 0 && (
        <p className="ql-empty">No saved quotes yet.</p>
      )}

      {quotes.length > 0 && filtered.length === 0 && (
        <p className="ql-empty">No quotes match "{search}".</p>
      )}

      <div className="ql-items">
        {filtered.map((q) => (
          <button
            key={q.meta.id}
            type="button"
            className={`ql-item ${q.meta.id === currentId ? "active" : ""}`}
            onClick={() => onSelect(q)}
          >
            <div className="ql-item-left">
              <span className="ql-item-title">{q.meta.quoteNumber || "Untitled Quote"}</span>
              {q.meta.customerName && (
                <span className="ql-item-customer">{q.meta.customerName}</span>
              )}
              <span className="ql-item-date">{q.meta.updatedAt}</span>
            </div>
            <div className="ql-item-right">
              <span className="ql-item-total">{formatCurrency(quoteTotal(q))}</span>
              <button
                type="button"
                className="ql-delete"
                title="Delete quote"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("Delete this quote?")) {
                    deleteQuote(q.meta.id, userId);
                    if (q.meta.id === currentId) onNew();
                    else window.location.reload();
                  }
                }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
