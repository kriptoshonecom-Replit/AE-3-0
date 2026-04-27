import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface Tier {
  lowVolume: number;
  highVolume: number;
  txnRate: number;
  txnCount: number;
}

interface TierModel {
  id: string;
  name: string;
  description: string;
  tiers: Tier[];
}

interface PayCategory {
  id: string;
  name: string;
  models: TierModel[];
}

interface StatusPassData {
  categories: PayCategory[];
  costBuffer: number;
  paymentCosts: number;
  gatewayCost: number;
  processingCost: number;
}

function fmtVol(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtFee(n: number): string {
  if (n === 0) return "$ —";
  return `$${n.toFixed(2)}`;
}

function parseDollar(raw: string): number {
  return parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
}

function fmtCurrency(raw: string): string {
  const n = parseDollar(raw);
  if (!n) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CalcContext {
  quoteId: string;
  quoteName: string;
  annualRevenue: string;
  avgTicket: string;
  numSites: string;
  requestedSubscriptionAmount: string;
  requestedUpfrontAmount: string;
  basisPoint: string;
  voyixPayTransactionFee: string;
  aeCurrentMonthlySpend: string;
  aeCurrentVoyixPaySpend: string;
}

const EMPTY_CTX: CalcContext = {
  quoteId: "", quoteName: "", annualRevenue: "", avgTicket: "", numSites: "",
  requestedSubscriptionAmount: "", requestedUpfrontAmount: "",
  basisPoint: "", voyixPayTransactionFee: "",
  aeCurrentMonthlySpend: "", aeCurrentVoyixPaySpend: "",
};

function readCalcContext(): CalcContext {
  try {
    // Remove any stale value left in localStorage from previous app versions
    localStorage.removeItem("cpq_sp_context");
    const raw = sessionStorage.getItem("cpq_sp_context");
    if (raw) return { ...EMPTY_CTX, ...JSON.parse(raw) } as CalcContext;
  } catch { /* ignore */ }
  return { ...EMPTY_CTX };
}

/* ── Inline editable cell ────────────────────────────────── */
interface InlineCellProps {
  value: string;
  inputType?: "number" | "text";
  step?: number;
  min?: number;
  width?: number;
  onSave: (raw: string) => void;
}

function InlineCell({ value, inputType = "number", step = 1, min = 0, width = 90, onSave }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  function startEdit() {
    setDraft(value);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={inputType}
        value={draft}
        step={step}
        min={min}
        autoFocus
        style={{ width }}
        className="inline-cell-input"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span className="inline-cell-display sp-inline-cell" onClick={startEdit} title="Click to edit">
      {value}
    </span>
  );
}

/* ── Tiered bucket distribution ──────────────────────────── */
interface TierBucket {
  txnCount: number;
  txnFee: number;
}

function computeTierBuckets(tiers: Tier[], totalTxns: number): TierBucket[] {
  let remaining = totalTxns;
  return tiers.map((tier, idx) => {
    const isLast = tier.highVolume === tier.lowVolume;
    // Capacity = how many TXNs this tier can absorb
    const capacity = isLast
      ? Infinity
      : idx === 0
      ? tier.highVolume                                   // Tier 1: 0 → highVolume
      : tier.highVolume - tiers[idx - 1].highVolume;     // Tier n: prev.high → this.high
    const used = Math.min(remaining, capacity);
    remaining = Math.max(0, remaining - used);
    return { txnCount: used, txnFee: used * tier.txnRate };
  });
}

/* ── Tier Table ───────────────────────────────────────────── */
interface TierTableProps {
  model: TierModel;
  catId: string;
  computedTxnCount: number;
  onTierSave: (catId: string, modelId: string, tierIdx: number, field: string, raw: string) => void;
}

function TierTable({ model, catId, computedTxnCount, onTierSave }: TierTableProps) {
  const buckets = computeTierBuckets(model.tiers, computedTxnCount);
  const totalFee = buckets.reduce((s, b) => s + b.txnFee, 0);
  const totalCount = buckets.reduce((s, b) => s + b.txnCount, 0);

  return (
    <div className="sp-table-wrap">
      <table className="admin-products-table sp-table">
        <thead>
          <tr>
            <th className="sp-th-tier">Tier</th>
            <th className="sp-th-vol">Low Volume</th>
            <th className="sp-th-vol">High Volume</th>
            <th className="sp-th-rate">Txn $</th>
            <th className="sp-th-count">Txn #</th>
            <th className="sp-th-fee">Txn Fees</th>
          </tr>
        </thead>
        <tbody>
          {model.tiers.map((tier, idx) => {
            const isLast = tier.highVolume === tier.lowVolume;
            const { txnCount: rowTxnCount, txnFee: rowTxnFee } = buckets[idx];
            return (
              <tr key={idx}>
                <td className="sp-td-tier">{idx + 1}</td>
                <td>
                  <InlineCell
                    value={String(tier.lowVolume)}
                    inputType="number" step={1} min={0} width={110}
                    onSave={(v) => onTierSave(catId, model.id, idx, "lowVolume", v)}
                  />
                </td>
                <td>
                  {isLast ? (
                    <span className="sp-last-tier">{fmtVol(tier.highVolume)}+</span>
                  ) : (
                    <InlineCell
                      value={String(tier.highVolume)}
                      inputType="number" step={1} min={0} width={110}
                      onSave={(v) => onTierSave(catId, model.id, idx, "highVolume", v)}
                    />
                  )}
                </td>
                <td>
                  <InlineCell
                    value={tier.txnRate.toFixed(4)}
                    inputType="number" step={0.0001} min={0} width={90}
                    onSave={(v) => onTierSave(catId, model.id, idx, "txnRate", v)}
                  />
                </td>
                <td className="sp-td-count">
                  {computedTxnCount > 0 && rowTxnCount > 0 ? fmtVol(rowTxnCount) : "—"}
                </td>
                <td className="sp-td-fee">{fmtFee(rowTxnFee)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="sp-total-row">
            <td colSpan={4} className="sp-total-label">Total</td>
            <td className="sp-td-count sp-total-num">
              {computedTxnCount > 0 ? fmtVol(totalCount) : "—"}
            </td>
            <td className="sp-td-fee sp-total-fee">{fmtFee(totalFee)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ── Calculator bar (read-only — values from Payments Config Panel) ── */
interface CalcBarProps {
  annualRevenue: string;
  avgTicket: string;
  numSites: string;
  computedTxnCount: number;
}

function CalcBar({ annualRevenue, avgTicket, numSites, computedTxnCount }: CalcBarProps) {
  const hasValues = parseDollar(annualRevenue) > 0 && parseDollar(avgTicket) > 0 && parseFloat(numSites) > 0;

  return (
    <div className="sp-calc-bar">
      <div className="sp-calc-header">
        <div className="sp-calc-title">Txn # Calculator</div>
        <div className="sp-calc-source">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v5l3 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Values pulled from Payments Configuration Panel
        </div>
      </div>
      <div className="sp-calc-fields">
        <div className="sp-calc-field">
          <label className="sp-calc-label">Annual Store Revenue</label>
          <div className={`sp-calc-readonly ${!parseDollar(annualRevenue) ? "sp-calc-empty" : ""}`}>
            {fmtCurrency(annualRevenue)}
          </div>
        </div>
        <div className="sp-calc-sep">÷</div>
        <div className="sp-calc-field">
          <label className="sp-calc-label">Average Ticket Amount</label>
          <div className={`sp-calc-readonly ${!parseDollar(avgTicket) ? "sp-calc-empty" : ""}`}>
            {fmtCurrency(avgTicket)}
          </div>
        </div>
        <div className="sp-calc-sep">÷ 12 ×</div>
        <div className="sp-calc-field">
          <label className="sp-calc-label">Number of Sites</label>
          <div className={`sp-calc-readonly ${!parseFloat(numSites) ? "sp-calc-empty" : ""}`}>
            {parseFloat(numSites) > 0 ? parseFloat(numSites).toLocaleString() : "—"}
          </div>
        </div>
        <div className={`sp-calc-result ${!hasValues ? "sp-calc-result-empty" : ""}`}>
          <div className="sp-calc-result-label">Txn #</div>
          <div className="sp-calc-result-value">
            {computedTxnCount > 0 ? computedTxnCount.toLocaleString() : "—"}
          </div>
        </div>
      </div>
      {!hasValues && (
        <div className="sp-calc-hint">
          Fill in Annual Store Revenue, Average Ticket Amount, and Number of Sites in the Payments Configuration Panel to compute Txn #.
        </div>
      )}
    </div>
  );
}

/* ── Site count → model ID ───────────────────────────────── */
function modelIdFromSites(sites: number): { id: string; label: string } {
  if (sites > 0 && sites < 10) return { id: "smb", label: "SMB (< 10 sites)" };
  if (sites >= 10 && sites <= 50) return { id: "mid-market", label: "Mid-Market (10–50 sites)" };
  if (sites > 50) return { id: "enterprise", label: "Enterprise (50+ sites)" };
  return { id: "", label: "" };
}

/* ── Blended Rate bar ────────────────────────────────────── */
interface BlendedRateBarProps {
  numSites: string;
  rawTxnCount: number;
  computedTxnCount: number;
  categories: PayCategory[];
  activeCatId: string;
}

function BlendedRateBar({ numSites, rawTxnCount, computedTxnCount, categories, activeCatId }: BlendedRateBarProps) {
  const sites = parseFloat(numSites);
  const { id: modelId, label: modelLabel } = sites > 0 ? modelIdFromSites(sites) : { id: "", label: "" };

  const activeCat = categories.find((c) => c.id === activeCatId);
  const model = activeCat?.models.find((m) => m.id === modelId);
  const buckets = model ? computeTierBuckets(model.tiers, computedTxnCount) : [];
  const txnFees = buckets.reduce((sum, b) => sum + b.txnFee, 0);
  const blendedRate = rawTxnCount > 0 && txnFees > 0 ? txnFees / rawTxnCount : 0;

  const hasValues = rawTxnCount > 0 && computedTxnCount > 0 && modelId !== "";

  return (
    <div className="sp-blended-bar">
      <div className="sp-calc-header">
        <div className="sp-calc-title">Blended Rate</div>
        {modelLabel && (
          <div className="sp-blended-model-tag">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M3.5 6h5M6 3.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {modelLabel}
          </div>
        )}
      </div>

      <div className="sp-blended-fields">
        <div className="sp-blended-field">
          <label className="sp-calc-label">TXN Fees</label>
          <div className={`sp-calc-readonly ${!hasValues ? "sp-calc-empty" : ""}`}>
            {hasValues ? `$${txnFees.toFixed(2)}` : "—"}
          </div>
        </div>

        <div className="sp-calc-sep">÷</div>

        <div className="sp-blended-field">
          <label className="sp-calc-label">TXN # (before rounding)</label>
          <div className={`sp-calc-readonly ${!hasValues ? "sp-calc-empty" : ""}`}>
            {hasValues ? rawTxnCount.toFixed(4) : "—"}
          </div>
        </div>

        <div className="sp-calc-sep">=</div>

        <div className={`sp-blended-result ${!hasValues ? "sp-calc-result-empty" : ""}`}>
          <div className="sp-calc-result-label">Blended Rate</div>
          <div className="sp-blended-result-value">
            {hasValues ? `$${blendedRate.toFixed(4)}` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Blended rate helper (shared with TotalRevenueBar) ───── */
function computeBlendedRateValue(
  categories: PayCategory[],
  activeCatId: string,
  numSites: string,
  computedTxnCount: number,
  rawTxnCount: number,
): number {
  const sites = parseFloat(numSites);
  const { id: modelId } = sites > 0 ? modelIdFromSites(sites) : { id: "" };
  const cat = categories.find((c) => c.id === activeCatId);
  const model = cat?.models.find((m) => m.id === modelId);
  const buckets = model ? computeTierBuckets(model.tiers, computedTxnCount) : [];
  const txnFees = buckets.reduce((sum, b) => sum + b.txnFee, 0);
  return rawTxnCount > 0 && txnFees > 0 ? txnFees / rawTxnCount : 0;
}

function fmtMoney(n: number): string {
  if (!isFinite(n) || n === 0) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ── Total Revenue section ───────────────────────────────── */
const TR_COLS = ["Month 1", "Year 1", "Year 2", "Year 3", "Total"];

interface TotalRevenueBarProps {
  calcCtx: CalcContext;
  annualTxnCount: number;
  blendedRate: number;
}

function TotalRevenueBar({ calcCtx, annualTxnCount, blendedRate }: TotalRevenueBarProps) {
  const subscriptionAmt = parseDollar(calcCtx.requestedSubscriptionAmount);
  const upfrontAmt      = parseDollar(calcCtx.requestedUpfrontAmount);
  const annualRevenue   = parseDollar(calcCtx.annualRevenue);
  // basisPoint is always stored as a whole number (e.g. 30 = 30 bp = 0.0030).
  const bpDecimal       = (parseFloat(calcCtx.basisPoint) || 0) / 10000;
  const voyixFee        = parseFloat(calcCtx.voyixPayTransactionFee) || 0;

  // Month 1 — monthly slice of each recurring value
  const subM1         = subscriptionAmt;
  const upfrontM1     = upfrontAmt;
  const paymentsRevM1 = annualRevenue > 0 || annualTxnCount > 0
    ? ((bpDecimal * annualRevenue) + (voyixFee * annualTxnCount)) / 12
    : 0;
  const gatewayRevM1  = annualTxnCount > 0 && blendedRate > 0
    ? (annualTxnCount * blendedRate) / 12
    : 0;

  // Year 1 — recurring rows ×12; upfront is one-time (stays as M1 value, not ×12)
  const subY1         = subM1 * 12;
  const upfrontY1     = upfrontM1;   // one-time only
  const paymentsRevY1 = paymentsRevM1 * 12;
  const gatewayRevY1  = gatewayRevM1 * 12;

  // Year 2 & 3 — same as Year 1 for recurring rows; upfront is gone (one-time)
  const subY2         = subY1;
  const upfrontY2     = 0;
  const paymentsRevY2 = paymentsRevY1;
  const gatewayRevY2  = gatewayRevY1;

  const subY3         = subY1;
  const upfrontY3     = 0;
  const paymentsRevY3 = paymentsRevY1;
  const gatewayRevY3  = gatewayRevY1;

  // Totals per row = Y1 + Y2 + Y3
  const subTotal         = subY1 + subY2 + subY3;
  const upfrontTotal     = upfrontY1 + upfrontY2 + upfrontY3;
  const paymentsRevTotal = paymentsRevY1 + paymentsRevY2 + paymentsRevY3;
  const gatewayRevTotal  = gatewayRevY1 + gatewayRevY2 + gatewayRevY3;

  // Column totals (sum of all rows per column)
  const totalM1 = subM1 + upfrontM1 + paymentsRevM1 + gatewayRevM1;
  const totalY1 = subY1 + upfrontY1 + paymentsRevY1 + gatewayRevY1;
  const totalY2 = subY2 + upfrontY2 + paymentsRevY2 + gatewayRevY2;
  const totalY3 = subY3 + upfrontY3 + paymentsRevY3 + gatewayRevY3;
  const grandTotal = totalY1 + totalY2 + totalY3;

  const hasAny = subM1 > 0 || upfrontM1 > 0 || paymentsRevM1 > 0 || gatewayRevM1 > 0;

  // [label, m1, y1, y2, y3, rowTotal]
  const rows: [string, number, number, number, number, number][] = [
    ["Requested Subscription Amount",       subM1,         subY1,         subY2,         subY3,         subTotal],
    ["Requested Upfront Amount (PIT Related)", upfrontM1,  upfrontY1,     upfrontY2,     upfrontY3,     upfrontTotal],
    ["Payments Revenue (net)",              paymentsRevM1, paymentsRevY1, paymentsRevY2, paymentsRevY3, paymentsRevTotal],
    ["Gateway Revenue",                     gatewayRevM1,  gatewayRevY1,  gatewayRevY2,  gatewayRevY3,  gatewayRevTotal],
  ];

  const val = (n: number) => (
    <td className="sp-tr-td-val sp-tr-td-live">{fmtMoney(n)}</td>
  );

  return (
    <div className="sp-tr-bar">
      <div className="sp-calc-header">
        <div className="sp-calc-title">Total Revenue</div>
        {!hasAny && (
          <div className="sp-calc-source">Fill in quote fields to compute revenue</div>
        )}
      </div>

      <div className="sp-tr-table-wrap">
        <table className="sp-tr-table">
          <thead>
            <tr>
              <th className="sp-tr-th-label"></th>
              {TR_COLS.map((col) => (
                <th key={col} className="sp-tr-th-col">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, m1, y1, y2, y3, rowTotal]) => (
              <tr key={label} className="sp-tr-row">
                <td className="sp-tr-td-label">{label}</td>
                {val(m1)}
                {val(y1)}
                {val(y2)}
                {val(y3)}
                {val(rowTotal)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="sp-tr-total-row">
              <td className="sp-tr-td-label sp-tr-total-label">Total</td>
              <td className="sp-tr-td-val sp-tr-total-val">{hasAny ? fmtMoney(totalM1) : "—"}</td>
              <td className="sp-tr-td-val sp-tr-total-val">{hasAny ? fmtMoney(totalY1) : "—"}</td>
              <td className="sp-tr-td-val sp-tr-total-val">{hasAny ? fmtMoney(totalY2) : "—"}</td>
              <td className="sp-tr-td-val sp-tr-total-val">{hasAny ? fmtMoney(totalY3) : "—"}</td>
              <td className="sp-tr-td-val sp-tr-total-val">{hasAny ? fmtMoney(grandTotal) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ── Prior Spend vs Requested Pricing ───────────────────── */
interface PriorSpendBarProps {
  calcCtx: CalcContext;
  annualTxnCount: number;
  blendedRate: number;
}

function PriorSpendBar({ calcCtx, annualTxnCount, blendedRate }: PriorSpendBarProps) {
  const [threshold, setThreshold] = useState<number>(15);

  // Prior Monthly Spend = Current Monthly Spend + Current Voyix Pay Spend
  const priorMonthly =
    parseDollar(calcCtx.aeCurrentMonthlySpend) +
    parseDollar(calcCtx.aeCurrentVoyixPaySpend);

  // Proposed Monthly Spend = Subscription M1 + Payments Revenue M1 + Gateway Revenue M1
  const annualRevenue = parseDollar(calcCtx.annualRevenue);
  const bpDecimal     = (parseFloat(calcCtx.basisPoint) || 0) / 10000;
  const voyixFee      = parseFloat(calcCtx.voyixPayTransactionFee) || 0;

  const subM1         = parseDollar(calcCtx.requestedSubscriptionAmount);
  const paymentsRevM1 = annualRevenue > 0 || annualTxnCount > 0
    ? ((bpDecimal * annualRevenue) + (voyixFee * annualTxnCount)) / 12
    : 0;
  const gatewayRevM1  = annualTxnCount > 0 && blendedRate > 0
    ? (annualTxnCount * blendedRate) / 12
    : 0;
  const proposedMonthly = subM1 + paymentsRevM1 + gatewayRevM1;

  // Variance (%) = (Proposed - Prior) / Prior × 100
  const variance = priorMonthly > 0
    ? ((proposedMonthly - priorMonthly) / priorMonthly) * 100
    : null;

  // PASS/FAIL: variance < threshold → FAIL, variance >= threshold → PASS
  const result: "PASS" | "FAIL" | null =
    variance !== null ? (variance < threshold ? "FAIL" : "PASS") : null;

  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  return (
    <div className="sp-ps-bar">
      <div className="sp-calc-header">
        <div className="sp-calc-title">Prior Spend vs Requested Pricing</div>
      </div>
      <div className="sp-ps-grid">
        <div className="sp-ps-field">
          <span className="sp-ps-label">Prior Monthly Spend</span>
          <span className="sp-ps-value">
            {priorMonthly > 0 ? fmtMoney(priorMonthly) : "—"}
          </span>
          <span className="sp-ps-hint">
            Current Monthly + Current Voyix Pay
          </span>
        </div>

        <div className="sp-ps-field">
          <span className="sp-ps-label">Proposed Monthly Spend</span>
          <span className="sp-ps-value">
            {proposedMonthly > 0 ? fmtMoney(proposedMonthly) : "—"}
          </span>
          <span className="sp-ps-hint">
            Subscription + Payments Revenue + Gateway Revenue
          </span>
        </div>

        <div className="sp-ps-field">
          <span className="sp-ps-label">Variance (%)</span>
          <span className={`sp-ps-value ${variance !== null ? (variance >= 0 ? "sp-ps-positive" : "sp-ps-negative") : ""}`}>
            {variance !== null ? fmtPct(variance) : "—"}
          </span>
          <span className="sp-ps-hint">
            (Proposed − Prior) ÷ Prior
          </span>
        </div>

        <div className="sp-ps-field">
          <span className="sp-ps-label">Threshold (%)</span>
          <div className="sp-ps-threshold-wrap">
            <input
              className="sp-ps-threshold-input"
              type="number"
              min={0}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
            />
            <span className="sp-ps-threshold-unit">%</span>
          </div>
        </div>

        <div className={`sp-ps-badge sp-ps-badge-${result?.toLowerCase() ?? "pending"}`}>
          {result ?? "—"}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */
export default function StatusPassConfigPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<StatusPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCat, setActiveCat] = useState("voyix-pay-yes");
  const [activeModel, setActiveModel] = useState("smb");
  const [calcCtx, setCalcCtx] = useState<CalcContext>(() => readCalcContext());

  useEffect(() => {
    setCalcCtx(readCalcContext());
  }, []);

  const annualTxnCount: number = (() => {
    const rev = parseDollar(calcCtx.annualRevenue);
    const ticket = parseDollar(calcCtx.avgTicket);
    if (!rev || !ticket || ticket === 0) return 0;
    return rev / ticket;
  })();

  const rawTxnCount: number = (() => {
    const rev = parseDollar(calcCtx.annualRevenue);
    const ticket = parseDollar(calcCtx.avgTicket);
    const sites = parseFloat(calcCtx.numSites);
    if (!rev || !ticket || !sites || ticket === 0) return 0;
    return (rev / ticket / 12) * sites;
  })();

  const computedTxnCount: number = rawTxnCount > 0 ? Math.round(rawTxnCount / 10) * 10 : 0;

  function loadData() {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/admin/status-pass`, { credentials: "include" })
      .then((r) => {
        if (r.status === 401) throw new Error("Session expired — please sign in again.");
        if (!r.ok) throw new Error("Failed to load configuration.");
        return r.json();
      })
      .then((d: StatusPassData) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { loadData(); }, []);

  async function handleTierSave(catId: string, modelId: string, tierIdx: number, field: string, raw: string) {
    const numVal = Number(raw);
    if (isNaN(numVal)) return;

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id !== catId ? cat : {
            ...cat,
            models: cat.models.map((m) =>
              m.id !== modelId ? m : {
                ...m,
                tiers: m.tiers.map((t, i) =>
                  i !== tierIdx ? t : { ...t, [field]: numVal },
                ),
              },
            ),
          },
        ),
      };
    });

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/status-pass/categories/${catId}/models/${modelId}/tiers/${tierIdx}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ [field]: numVal }),
        },
      );
      if (res.ok) {
        const d = await res.json() as StatusPassData;
        setData(d);
      }
    } catch { /* silent — optimistic state retained */ }
  }

  async function handleGlobalSave(field: "costBuffer" | "paymentCosts" | "gatewayCost" | "processingCost", raw: string) {
    const numVal = parseFloat(raw);
    if (isNaN(numVal) || numVal < 0) return;
    setData((prev) => prev ? { ...prev, [field]: numVal } : prev);
    try {
      await fetch(`${API_BASE}/api/admin/status-pass/global`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [field]: numVal }),
      });
    } catch { /* silent — optimistic state retained */ }
  }

  const currentCat = data?.categories.find((c) => c.id === activeCat);
  const currentModel = currentCat?.models.find((m) => m.id === activeModel);

  const blendedRate = data
    ? computeBlendedRateValue(data.categories, activeCat, calcCtx.numSites, computedTxnCount, rawTxnCount)
    : 0;

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <button className="btn-ghost admin-back-btn" onClick={() => setLocation("/")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Quotes
        </button>
        <h1 className="admin-page-title">StatusPass Configuration</h1>
        {calcCtx.quoteName && (
          <div className="sp-quote-badge">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M3.5 4h5M3.5 6h5M3.5 8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            {calcCtx.quoteName}
          </div>
        )}
        <button
          className="btn-ghost sp-refresh-btn"
          onClick={loadData}
          disabled={loading}
          title="Reload data from server"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: loading ? "rotate(360deg)" : "none", transition: "transform 0.5s" }}>
            <path d="M12 7A5 5 0 1 1 7 2a5 5 0 0 1 3.54 1.46L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Refresh
        </button>
      </div>

      {loading && <div className="admin-loading"><div className="spinner" /></div>}
      {error && <div className="admin-error">{error}</div>}

      {data && (
        <div className="admin-content">
          <div className="sp-page-inner">
            {/* Category tabs + global fields */}
            <div className="sp-cat-tabs-row">
              <div className="admin-cat-tabs sp-cat-tabs">
                {data.categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`admin-cat-tab ${activeCat === cat.id ? "admin-cat-tab-active" : ""}`}
                    onClick={() => { setActiveCat(cat.id); setActiveModel("smb"); }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="sp-global-fields">
                <div className="sp-global-field">
                  <span className="sp-global-label">Cost Buffer</span>
                  <div className="sp-global-value">
                    <InlineCell
                      value={String(data.costBuffer ?? 12)}
                      inputType="number"
                      step={1}
                      min={0}
                      width={60}
                      onSave={(v) => handleGlobalSave("costBuffer", v)}
                    />
                    <span className="sp-global-unit">%</span>
                  </div>
                </div>
                <div className="sp-global-field">
                  <span className="sp-global-label">Payment costs</span>
                  <div className="sp-global-value">
                    <InlineCell
                      value={String(data.paymentCosts ?? 2.25)}
                      inputType="number"
                      step={0.01}
                      min={0}
                      width={60}
                      onSave={(v) => handleGlobalSave("paymentCosts", v)}
                    />
                    <span className="sp-global-unit">%</span>
                  </div>
                </div>
                <div className="sp-global-field">
                  <span className="sp-global-label">Gateway cost</span>
                  <div className="sp-global-value">
                    <span className="sp-global-unit sp-global-unit-prefix">$</span>
                    <InlineCell
                      value={String(data.gatewayCost ?? 0.005)}
                      inputType="number"
                      step={0.001}
                      min={0}
                      width={70}
                      onSave={(v) => handleGlobalSave("gatewayCost", v)}
                    />
                  </div>
                </div>
                <div className="sp-global-field">
                  <span className="sp-global-label">Processing cost</span>
                  <div className="sp-global-value">
                    <span className="sp-global-unit sp-global-unit-prefix">$</span>
                    <InlineCell
                      value={String(data.processingCost ?? 0.0125)}
                      inputType="number"
                      step={0.0001}
                      min={0}
                      width={70}
                      onSave={(v) => handleGlobalSave("processingCost", v)}
                    />
                  </div>
                </div>
                <div className="sp-global-field">
                  <span className="sp-global-label">Annual TXN #</span>
                  <div className="sp-global-value">
                    <span className={`sp-global-readonly ${annualTxnCount === 0 ? "sp-global-readonly-empty" : ""}`}>
                      {annualTxnCount > 0
                        ? Math.round(annualTxnCount).toLocaleString("en-US")
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {currentCat && (
              <>
                {/* Model sub-tabs */}
                <div className="sp-model-tabs">
                  {currentCat.models.map((m) => (
                    <button
                      key={m.id}
                      className={`sp-model-tab ${activeModel === m.id ? "sp-model-tab-active" : ""}`}
                      onClick={() => setActiveModel(m.id)}
                    >
                      <span className="sp-model-tab-name">{m.name}</span>
                      <span className="sp-model-tab-desc">{m.description}</span>
                    </button>
                  ))}
                </div>

                {/* Calculator bar */}
                <CalcBar
                  annualRevenue={calcCtx.annualRevenue}
                  avgTicket={calcCtx.avgTicket}
                  numSites={calcCtx.numSites}
                  computedTxnCount={computedTxnCount}
                />

                {/* Blended Rate */}
                <BlendedRateBar
                  numSites={calcCtx.numSites}
                  rawTxnCount={rawTxnCount}
                  computedTxnCount={computedTxnCount}
                  categories={data.categories}
                  activeCatId={activeCat}
                />

                {/* Total Revenue */}
                <TotalRevenueBar
                  calcCtx={calcCtx}
                  annualTxnCount={annualTxnCount}
                  blendedRate={blendedRate}
                />

                {/* Prior Spend vs Requested Pricing */}
                <PriorSpendBar
                  calcCtx={calcCtx}
                  annualTxnCount={annualTxnCount}
                  blendedRate={blendedRate}
                />

                {/* Info banner */}
                {currentModel && (
                  <div className="sp-model-banner">
                    <span className="sp-banner-cat">{currentCat.name}</span>
                    <span className="sp-banner-sep">›</span>
                    <span className="sp-banner-model">{currentModel.name}</span>
                    <span className="sp-banner-desc">— {currentModel.description}</span>
                    <span className="sp-banner-hint">Click any cell in Low Volume, High Volume, or Txn $ to edit</span>
                  </div>
                )}

                {/* Tier table */}
                {currentModel && (
                  <TierTable
                    model={currentModel}
                    catId={currentCat.id}
                    computedTxnCount={computedTxnCount}
                    onTierSave={handleTierSave}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
