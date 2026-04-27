import { Router } from "express";
import { db } from "@workspace/db";
import { statusPassConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import pino from "pino";

const logger = pino();
const router = Router();
const CONFIG_ID = "default";

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

const DATA_VERSION = "3.1";

const DEFAULT_DATA: StatusPassData = {
  costBuffer: 12,
  paymentCosts: 2.25,
  gatewayCost: 0.005,
  processingCost: 0.0125,
  categories: [
    {
      id: "voyix-pay-yes",
      name: "Voyix Pay Yes",
      models: [
        {
          id: "smb",
          name: "SMB",
          description: "Less than 10 sites",
          tiers: [
            { lowVolume: 0,       highVolume: 2500,   txnRate: 0.0500, txnCount: 20 },
            { lowVolume: 2501,    highVolume: 5000,   txnRate: 0.0480, txnCount: 0 },
            { lowVolume: 5001,    highVolume: 7500,   txnRate: 0.0460, txnCount: 0 },
            { lowVolume: 7501,    highVolume: 10000,  txnRate: 0.0440, txnCount: 0 },
            { lowVolume: 10001,   highVolume: 15000,  txnRate: 0.0420, txnCount: 0 },
            { lowVolume: 15001,   highVolume: 20000,  txnRate: 0.0400, txnCount: 0 },
            { lowVolume: 20001,   highVolume: 25000,  txnRate: 0.0380, txnCount: 0 },
            { lowVolume: 25001,   highVolume: 35000,  txnRate: 0.0360, txnCount: 0 },
            { lowVolume: 35001,   highVolume: 50000,  txnRate: 0.0350, txnCount: 0 },
            { lowVolume: 50001,   highVolume: 65000,  txnRate: 0.0340, txnCount: 0 },
            { lowVolume: 65001,   highVolume: 85000,  txnRate: 0.0330, txnCount: 0 },
            { lowVolume: 85001,   highVolume: 105000, txnRate: 0.0320, txnCount: 0 },
            { lowVolume: 105001,  highVolume: 105001, txnRate: 0.0300, txnCount: 0 },
          ],
        },
        {
          id: "mid-market",
          name: "Mid-Market",
          description: "10 to 50 sites",
          tiers: [
            { lowVolume: 0,       highVolume: 20000,  txnRate: 0.0400, txnCount: 20 },
            { lowVolume: 20001,   highVolume: 30000,  txnRate: 0.0380, txnCount: 0 },
            { lowVolume: 30001,   highVolume: 40000,  txnRate: 0.0360, txnCount: 0 },
            { lowVolume: 40001,   highVolume: 50000,  txnRate: 0.0350, txnCount: 0 },
            { lowVolume: 50001,   highVolume: 75000,  txnRate: 0.0325, txnCount: 0 },
            { lowVolume: 75001,   highVolume: 100000, txnRate: 0.0300, txnCount: 0 },
            { lowVolume: 100001,  highVolume: 125000, txnRate: 0.0285, txnCount: 0 },
            { lowVolume: 125001,  highVolume: 150000, txnRate: 0.0270, txnCount: 0 },
            { lowVolume: 150001,  highVolume: 200000, txnRate: 0.0255, txnCount: 0 },
            { lowVolume: 200001,  highVolume: 250000, txnRate: 0.0240, txnCount: 0 },
            { lowVolume: 250001,  highVolume: 300000, txnRate: 0.0225, txnCount: 0 },
            { lowVolume: 300001,  highVolume: 400000, txnRate: 0.0215, txnCount: 0 },
            { lowVolume: 400001,  highVolume: 400001, txnRate: 0.0200, txnCount: 0 },
          ],
        },
        {
          id: "enterprise",
          name: "Enterprise",
          description: "50+ sites",
          tiers: [
            { lowVolume: 0,          highVolume: 125000,    txnRate: 0.0285, txnCount: 20 },
            { lowVolume: 125001,     highVolume: 175000,    txnRate: 0.0260, txnCount: 0 },
            { lowVolume: 175001,     highVolume: 225000,    txnRate: 0.0250, txnCount: 0 },
            { lowVolume: 225001,     highVolume: 300000,    txnRate: 0.0225, txnCount: 0 },
            { lowVolume: 300001,     highVolume: 500000,    txnRate: 0.0200, txnCount: 0 },
            { lowVolume: 500001,     highVolume: 750000,    txnRate: 0.0180, txnCount: 0 },
            { lowVolume: 750001,     highVolume: 1000000,   txnRate: 0.0160, txnCount: 0 },
            { lowVolume: 1000001,    highVolume: 2000000,   txnRate: 0.0140, txnCount: 0 },
            { lowVolume: 2000001,    highVolume: 5000000,   txnRate: 0.0120, txnCount: 0 },
            { lowVolume: 5000001,    highVolume: 10000000,  txnRate: 0.0100, txnCount: 0 },
            { lowVolume: 10000001,   highVolume: 15000000,  txnRate: 0.0080, txnCount: 0 },
            { lowVolume: 15000001,   highVolume: 25000000,  txnRate: 0.0070, txnCount: 0 },
            { lowVolume: 25000001,   highVolume: 25000001,  txnRate: 0.0060, txnCount: 0 },
          ],
        },
      ],
    },
    {
      id: "voyix-pay-no",
      name: "Voyix Pay No",
      models: [
        {
          id: "smb",
          name: "SMB",
          description: "Less than 10 sites",
          tiers: [
            { lowVolume: 0,       highVolume: 2500,   txnRate: 0.0750, txnCount: 20 },
            { lowVolume: 2501,    highVolume: 5000,   txnRate: 0.0730, txnCount: 0 },
            { lowVolume: 5001,    highVolume: 7500,   txnRate: 0.0710, txnCount: 0 },
            { lowVolume: 7501,    highVolume: 10000,  txnRate: 0.0690, txnCount: 0 },
            { lowVolume: 10001,   highVolume: 15000,  txnRate: 0.0670, txnCount: 0 },
            { lowVolume: 15001,   highVolume: 20000,  txnRate: 0.0625, txnCount: 0 },
            { lowVolume: 20001,   highVolume: 25000,  txnRate: 0.0605, txnCount: 0 },
            { lowVolume: 25001,   highVolume: 35000,  txnRate: 0.0585, txnCount: 0 },
            { lowVolume: 35001,   highVolume: 50000,  txnRate: 0.0575, txnCount: 0 },
            { lowVolume: 50001,   highVolume: 65000,  txnRate: 0.0565, txnCount: 0 },
            { lowVolume: 65001,   highVolume: 85000,  txnRate: 0.0530, txnCount: 0 },
            { lowVolume: 85001,   highVolume: 105000, txnRate: 0.0520, txnCount: 0 },
            { lowVolume: 105001,  highVolume: 105001, txnRate: 0.0500, txnCount: 0 },
          ],
        },
        {
          id: "mid-market",
          name: "Mid-Market",
          description: "10 to 50 sites",
          tiers: [
            { lowVolume: 0,       highVolume: 20000,   txnRate: 0.0625, txnCount: 20 },
            { lowVolume: 20001,   highVolume: 30000,   txnRate: 0.0605, txnCount: 0 },
            { lowVolume: 30001,   highVolume: 40000,   txnRate: 0.0585, txnCount: 0 },
            { lowVolume: 40001,   highVolume: 50000,   txnRate: 0.0575, txnCount: 0 },
            { lowVolume: 50001,   highVolume: 75000,   txnRate: 0.0550, txnCount: 0 },
            { lowVolume: 75001,   highVolume: 100000,  txnRate: 0.0500, txnCount: 0 },
            { lowVolume: 100001,  highVolume: 125000,  txnRate: 0.0485, txnCount: 0 },
            { lowVolume: 125001,  highVolume: 150000,  txnRate: 0.0470, txnCount: 0 },
            { lowVolume: 150001,  highVolume: 200000,  txnRate: 0.0455, txnCount: 0 },
            { lowVolume: 200001,  highVolume: 250000,  txnRate: 0.0440, txnCount: 0 },
            { lowVolume: 250001,  highVolume: 300000,  txnRate: 0.0375, txnCount: 0 },
            { lowVolume: 300001,  highVolume: 400000,  txnRate: 0.0365, txnCount: 0 },
            { lowVolume: 400001,  highVolume: 400001,  txnRate: 0.0350, txnCount: 0 },
          ],
        },
        {
          id: "enterprise",
          name: "Enterprise",
          description: "50+ sites",
          tiers: [
            { lowVolume: 0,          highVolume: 125000,    txnRate: 0.0485, txnCount: 20 },
            { lowVolume: 125001,     highVolume: 175000,    txnRate: 0.0460, txnCount: 0 },
            { lowVolume: 175001,     highVolume: 225000,    txnRate: 0.0400, txnCount: 0 },
            { lowVolume: 225001,     highVolume: 300000,    txnRate: 0.0375, txnCount: 0 },
            { lowVolume: 300001,     highVolume: 500000,    txnRate: 0.0300, txnCount: 0 },
            { lowVolume: 500001,     highVolume: 750000,    txnRate: 0.0280, txnCount: 0 },
            { lowVolume: 750001,     highVolume: 1000000,   txnRate: 0.0210, txnCount: 0 },
            { lowVolume: 1000001,    highVolume: 2000000,   txnRate: 0.0190, txnCount: 0 },
            { lowVolume: 2000001,    highVolume: 5000000,   txnRate: 0.0120, txnCount: 0 },
            { lowVolume: 5000001,    highVolume: 10000000,  txnRate: 0.0100, txnCount: 0 },
            { lowVolume: 10000001,   highVolume: 15000000,  txnRate: 0.0080, txnCount: 0 },
            { lowVolume: 15000001,   highVolume: 25000000,  txnRate: 0.0070, txnCount: 0 },
            { lowVolume: 25000001,   highVolume: 25000001,  txnRate: 0.0060, txnCount: 0 },
          ],
        },
      ],
    },
  ],
};

async function readConfig(): Promise<StatusPassData> {
  const [row] = await db
    .select()
    .from(statusPassConfigTable)
    .where(eq(statusPassConfigTable.id, CONFIG_ID))
    .limit(1);

  const storedVersion = (row?.data as Record<string, unknown>)?._version as string | undefined;
  if (!row || storedVersion !== DATA_VERSION) {
    // No record or stale version — seed / overwrite with current defaults
    const seedData = { ...DEFAULT_DATA, _version: DATA_VERSION } as unknown as Record<string, unknown>;
    await db
      .insert(statusPassConfigTable)
      .values({ id: CONFIG_ID, data: seedData })
      .onConflictDoUpdate({
        target: statusPassConfigTable.id,
        set: { data: seedData, updatedAt: new Date() },
      });
    return DEFAULT_DATA;
  }

  // Merge stored data with defaults for any new top-level fields added after initial seed
  const stored = row.data as Partial<StatusPassData>;
  return {
    costBuffer: DEFAULT_DATA.costBuffer,
    paymentCosts: DEFAULT_DATA.paymentCosts,
    gatewayCost: DEFAULT_DATA.gatewayCost,
    processingCost: DEFAULT_DATA.processingCost,
    ...stored,
    categories: stored.categories ?? DEFAULT_DATA.categories,
  };
}

async function writeConfig(data: StatusPassData) {
  await db
    .insert(statusPassConfigTable)
    .values({ id: CONFIG_ID, data: data as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: statusPassConfigTable.id,
      set: { data: data as unknown as Record<string, unknown>, updatedAt: new Date() },
    });
}

router.get("/admin/status-pass", requireAdmin, async (_req, res) => {
  try {
    const data = await readConfig();
    res.json(data);
  } catch (err) {
    logger.error(err, "status-pass get error");
    res.status(500).json({ error: "Failed to load config" });
  }
});

router.patch("/admin/status-pass/global", requireAdmin, async (req, res) => {
  try {
    const { costBuffer, paymentCosts, gatewayCost, processingCost } = req.body as Partial<Pick<StatusPassData, "costBuffer" | "paymentCosts" | "gatewayCost" | "processingCost">>;
    const data = await readConfig();
    if (costBuffer !== undefined) data.costBuffer = costBuffer;
    if (paymentCosts !== undefined) data.paymentCosts = paymentCosts;
    if (gatewayCost !== undefined) data.gatewayCost = gatewayCost;
    if (processingCost !== undefined) data.processingCost = processingCost;
    const versionedData = { ...data, _version: DATA_VERSION };
    await writeConfig(versionedData as StatusPassData);
    res.json(data);
  } catch (err) {
    logger.error(err, "status-pass patch global error");
    res.status(500).json({ error: "Failed to update" });
  }
});

router.patch(
  "/admin/status-pass/categories/:catId/models/:modelId/tiers/:tierIdx",
  requireAdmin,
  async (req, res) => {
    try {
      const { catId, modelId, tierIdx } = req.params;
      const idx = parseInt(tierIdx, 10);
      const updates = req.body as Partial<Pick<Tier, "lowVolume" | "highVolume" | "txnRate">>;

      const data = await readConfig();
      const cat = data.categories.find((c) => c.id === catId);
      if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
      const model = cat.models.find((m) => m.id === modelId);
      if (!model) { res.status(404).json({ error: "Model not found" }); return; }
      if (idx < 0 || idx >= model.tiers.length) { res.status(400).json({ error: "Tier index out of range" }); return; }

      model.tiers[idx] = { ...model.tiers[idx], ...updates };
      const versionedData = { ...data, _version: DATA_VERSION };
      await writeConfig(versionedData as StatusPassData);
      res.json(data);
    } catch (err) {
      logger.error(err, "status-pass patch tier error");
      res.status(500).json({ error: "Failed to update tier" });
    }
  },
);

export default router;
