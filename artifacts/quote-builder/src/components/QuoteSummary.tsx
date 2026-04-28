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
  pitTotal: number;
  productPitTotal: number;
  heatmapTotal: number;
  legacyTotal: number;
  pspmDiscountPct?: number;
  upfrontPriceDiscountPct?: number;
  voyixTxnFee?: number;
  gatewayTxnRate?: number;
}

export default function QuoteSummary({
  quote,
  pitTotal,
  productPitTotal,
  heatmapTotal,
  legacyTotal,
  pspmDiscountPct,
  upfrontPriceDiscountPct,
  voyixTxnFee,
  gatewayTxnRate,
}: Props) {
  const subtotal = quoteSubtotal(quote);
  const discount = quoteDiscount(quote);
  const tax = quoteTax(quote);
  const productsTotal = quoteTotal(quote);
  const buyoutAmount = parseFloat((quote.meta.costOfBuyOut ?? "").replace(/[^0-9.]/g, "")) || 0;

  const fmtPct = (v?: number) =>
    v === undefined || isNaN(v) ? "—" : `${v.toFixed(2)}%`;

  const showDiscountSection =
    pspmDiscountPct !== undefined || upfrontPriceDiscountPct !== undefined;

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

        <div className="summary-row mrr-total">
          <span>MRR Total</span>
          <span>{formatCurrency(productsTotal)}</span>
        </div>

        {pitTotal > 0 && (
          <div className="summary-row">
            <span>PIT</span>
            <span>{formatCurrency(pitTotal)}</span>
          </div>
        )}

        {productPitTotal > 0 && (
          <div className="summary-row">
            <span>Product Related PIT</span>
            <span>{formatCurrency(productPitTotal)}</span>
          </div>
        )}

        <div className="summary-divider" />

        <div className="summary-row total">
          <span>Upfront Total</span>
          <span>{formatCurrency(pitTotal + productPitTotal)}</span>
        </div>

        {heatmapTotal > 0 && (
          <>
            <div className="summary-divider" />
            <div className="summary-row heatmap-row">
              <span>Heatmap &amp; Cabling</span>
              <span>{formatCurrency(heatmapTotal)}</span>
            </div>
          </>
        )}

        {buyoutAmount > 0 && (
          <>
            <div className="summary-divider" />
            <div className="summary-row heatmap-row">
              <span>Cost of BuyOut</span>
              <span>{formatCurrency(buyoutAmount)}</span>
            </div>
          </>
        )}

        {legacyTotal > 0 && (
          <>
            <div className="summary-divider" />
            <div className="summary-row heatmap-row">
              <span>Legacy HW Added</span>
              <span>{formatCurrency(legacyTotal)}</span>
            </div>
          </>
        )}
      </div>

      {showDiscountSection && (
        <div className="discount-analysis-section">
          <div className="discount-analysis-title">Discount Analysis</div>
          <div className="discount-analysis-rows">
            {pspmDiscountPct !== undefined && (
              <div className="discount-analysis-row">
                <span>PSPM Discount %</span>
                <span className="discount-analysis-value">{fmtPct(pspmDiscountPct)}</span>
              </div>
            )}
            {upfrontPriceDiscountPct !== undefined && (
              <div className="discount-analysis-row">
                <span>Upfront Price Discount %</span>
                <span className="discount-analysis-value">{fmtPct(upfrontPriceDiscountPct)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(voyixTxnFee !== undefined || gatewayTxnRate !== undefined) && (
        <div className="discount-analysis-section">
          <div className="discount-analysis-title">Payments Overview</div>
          <div className="discount-analysis-rows">
            {voyixTxnFee !== undefined && (
              <div className="discount-analysis-row">
                <span>Payments Processing Txn Rate</span>
                <span className="discount-analysis-value">
                  {voyixTxnFee > 0 ? `$${voyixTxnFee.toFixed(4)}` : "—"}
                </span>
              </div>
            )}
            {gatewayTxnRate !== undefined && (
              <div className="discount-analysis-row">
                <span>Gateway Payments Txn Rate</span>
                <span className="discount-analysis-value">
                  {gatewayTxnRate > 0 ? `$${gatewayTxnRate.toFixed(4)}` : "—"}
                </span>
              </div>
            )}
            {voyixTxnFee !== undefined && gatewayTxnRate !== undefined && (
              <div className="discount-analysis-row" style={{ borderTop: "1px solid var(--border)", paddingTop: "6px", marginTop: "2px" }}>
                <span style={{ fontWeight: 600 }}>Total Txn Rate</span>
                <span className="discount-analysis-value">
                  {(voyixTxnFee + gatewayTxnRate) > 0
                    ? `$${(voyixTxnFee + gatewayTxnRate).toFixed(4)}`
                    : "—"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="discount-analysis-section">
        <div className="discount-analysis-title">Customer Request</div>
        <div className="discount-analysis-rows">
          <div className="discount-analysis-row">
            <span>One-Time Initial Payment</span>
            <span className="discount-analysis-value">
              {(() => {
                const v = parseFloat((quote.meta.requestedUpfrontAmount ?? "").replace(/[^0-9.]/g, ""));
                return v > 0 ? formatCurrency(v) : "—";
              })()}
            </span>
          </div>
          <div className="discount-analysis-row">
            <span>Monthly Pricing Per Site</span>
            <span className="discount-analysis-value">
              {(() => {
                const v = parseFloat((quote.meta.requestedSubscriptionAmount ?? "").replace(/[^0-9.]/g, ""));
                return v > 0 ? formatCurrency(v) : "—";
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
