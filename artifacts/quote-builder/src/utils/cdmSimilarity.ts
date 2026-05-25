import type { QuoteMeta } from "../types";
import type { CustomerProfile } from "../pages/CDMPage";

export function findBestCdmMatch(
  meta: QuoteMeta,
  customers: CustomerProfile[],
): CustomerProfile | null {
  const inputMcn = (meta.mcn ?? "").trim();
  if (!inputMcn) return null;
  return customers.find((c) => (c.mcn ?? "").trim() === inputMcn) ?? null;
}
