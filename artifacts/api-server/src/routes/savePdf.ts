import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable, amendmentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { uploadPdf } from "../lib/pdfStorage";
import { logger } from "../lib/logger";

const router = Router();

router.post("/quotes/:id/save-pdf", requireAuth, async (req, res) => {
  const { userId, role } = req.auth!;
  const id = String(req.params.id);
  const { pdfBase64 } = req.body as { pdfBase64?: string };

  if (!pdfBase64) {
    res.status(400).json({ error: "pdfBase64 is required" });
    return;
  }

  try {
    const [existing] = await db
      .select({ id: quotesTable.id, userId: quotesTable.userId })
      .from(quotesTable)
      .where(eq(quotesTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    if (existing.userId !== userId && role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const base64Data = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
    const buffer = Buffer.from(base64Data, "base64");
    const storagePath = await uploadPdf("quotes", id, buffer);

    await db
      .update(quotesTable)
      .set({ pdfPath: storagePath, pdfSavedAt: new Date() })
      .where(eq(quotesTable.id, id));

    res.json({ saved: true, pdfPath: storagePath, pdfSavedAt: new Date().toISOString() });
  } catch (err) {
    logger.error(err, "POST /quotes/:id/save-pdf error");
    res.status(500).json({ error: "Failed to save PDF" });
  }
});

router.post("/amendments/:id/save-pdf", requireAuth, async (req, res) => {
  const { userId, role } = req.auth!;
  const id = String(req.params.id);
  const { pdfBase64 } = req.body as { pdfBase64?: string };

  if (!pdfBase64) {
    res.status(400).json({ error: "pdfBase64 is required" });
    return;
  }

  try {
    const [existing] = await db
      .select({ id: amendmentsTable.id, userId: amendmentsTable.userId })
      .from(amendmentsTable)
      .where(eq(amendmentsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Amendment not found" });
      return;
    }

    if (existing.userId !== userId && role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const base64Data = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
    const buffer = Buffer.from(base64Data, "base64");
    const storagePath = await uploadPdf("amendments", id, buffer);

    await db
      .update(amendmentsTable)
      .set({ pdfPath: storagePath, pdfSavedAt: new Date() })
      .where(eq(amendmentsTable.id, id));

    res.json({ saved: true, pdfPath: storagePath, pdfSavedAt: new Date().toISOString() });
  } catch (err) {
    logger.error(err, "POST /amendments/:id/save-pdf error");
    res.status(500).json({ error: "Failed to save PDF" });
  }
});

export default router;
