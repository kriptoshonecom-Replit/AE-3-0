import type { QuoteMeta } from "../types";
import type { CustomerProfile } from "../pages/CDMPage";

function normalizeText(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function tokenSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  const tokA = new Set(na.split(" ").filter(Boolean));
  const tokB = new Set(nb.split(" ").filter(Boolean));
  const intersection = [...tokA].filter((t) => tokB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  return union > 0 ? intersection / union : 0;
}

type FieldMode = "exact" | "phone" | "token";

interface FieldDef {
  input: string;
  record: string;
  mode: FieldMode;
}

export interface SimilarityResult {
  score: number;
  enteredCount: number;
  matchCount: number;
}

export function computeSimilarity(meta: QuoteMeta, customer: CustomerProfile): SimilarityResult {
  const fields: FieldDef[] = [
    { input: meta.customerEmail, record: customer.customerEmail, mode: "exact" },
    { input: meta.companyName, record: customer.companyName, mode: "token" },
    { input: meta.customerName, record: customer.customerName, mode: "token" },
    { input: meta.customerPhone ?? "", record: customer.customerPhone, mode: "phone" },
    { input: meta.zipCode ?? "", record: customer.address?.zip ?? "", mode: "exact" },
    { input: meta.addressName ?? "", record: customer.address?.name ?? "", mode: "token" },
  ];

  let enteredCount = 0;
  let matchCount = 0;

  for (const f of fields) {
    const inp = f.input.trim();
    const rec = f.record.trim();
    if (!inp) continue;
    enteredCount++;
    if (!rec) continue;

    let sim = 0;
    if (f.mode === "exact") {
      sim = normalizeText(inp) === normalizeText(rec) ? 1.0 : 0;
    } else if (f.mode === "phone") {
      const da = digitsOnly(inp);
      const db = digitsOnly(rec);
      sim = da.length >= 7 && db.length >= 7 && da === db ? 1.0 : 0;
    } else {
      sim = tokenSimilarity(inp, rec);
    }

    if (sim >= 0.65) matchCount++;
  }

  const score = enteredCount > 0 ? matchCount / enteredCount : 0;
  return { score, enteredCount, matchCount };
}

export function findBestCdmMatch(
  meta: QuoteMeta,
  customers: CustomerProfile[],
): CustomerProfile | null {
  // MCN exact match is a definitive hit — skip fuzzy scoring
  const inputMcn = (meta.mcn ?? "").trim();
  if (inputMcn) {
    const mcnMatch = customers.find(
      (c) => (c.mcn ?? "").trim() === inputMcn,
    );
    if (mcnMatch) return mcnMatch;
  }

  // Fuzzy similarity fallback (email / name / phone / address)
  let bestMatch: CustomerProfile | null = null;
  let bestScore = 0;

  for (const customer of customers) {
    const { score, enteredCount } = computeSimilarity(meta, customer);
    if (enteredCount < 2) continue;
    if (score > 0.6 && score > bestScore) {
      bestScore = score;
      bestMatch = customer;
    }
  }

  return bestMatch;
}
