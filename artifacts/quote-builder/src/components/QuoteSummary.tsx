import type { Quote } from "../types";
import {
  formatCurrency,
  quoteSubtotal,
  quoteDiscount,
  quoteTax,
  quoteTotal,
} from "../utils/calculations";

interface Props {
  quote: Quote;
}

export default function QuoteSummary({ quote }: Props) {
  const subtotal = quoteSubtotal(quote);
  const discount = quoteDiscount(quote);
  const tax = quoteTax(quote);
  const total = quoteTotal(quote);

  return (
    <div className="summary-panel">
      <div className="summary-rows">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        {quote.meta.discount > 0 && (
          <div className="summary-row discount">
            <span>Discount ({quote.meta.discount}%)</span>
            <span>- {formatCurrency(discount)}</span>
          </div>
        )}

        {quote.meta.tax > 0 && (
          <div className="summary-row">
            <span>Tax ({quote.meta.tax}%)</span>
            <span>{formatCurrency(tax)}</span>
          </div>
        )}

        <div className="summary-divider" />

        <div className="summary-row total">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
