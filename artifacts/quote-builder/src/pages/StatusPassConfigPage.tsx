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
  annualRevenue: string;
  avgTicket: string;
  numSites: string;
}

function readCalcContext(): CalcContext {
  try {
    const raw = localStorage.getItem("cpq_sp_context");
    if (raw) return JSON.parse(raw) as CalcContext;
  } catch { /* ignore */ }
  return { annualRevenue: "", avgTicket: "", numSites: "" };
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

  const rawTxnCount: number = (() => {
    const rev = parseDollar(calcCtx.annualRevenue);
    const ticket = parseDollar(calcCtx.avgTicket);
    const sites = parseFloat(calcCtx.numSites);
    if (!rev || !ticket || !sites || ticket === 0) return 0;
    return (rev / ticket / 12) * sites;
  })();

  const computedTxnCount: number = rawTxnCount > 0 ? Math.round(rawTxnCount / 10) * 10 : 0;

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/admin/status-pass`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject("load failed"))
      .then((d: StatusPassData) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load configuration"); setLoading(false); });
  }, []);

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

  const currentCat = data?.categories.find((c) => c.id === activeCat);
  const currentModel = currentCat?.models.find((m) => m.id === activeModel);

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
      </div>

      {loading && <div className="admin-loading"><div className="spinner" /></div>}
      {error && <div className="admin-error">{error}</div>}

      {data && (
        <div className="admin-content">
          <div className="sp-page-inner">
            {/* Category tabs */}
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
