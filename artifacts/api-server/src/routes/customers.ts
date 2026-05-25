import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { sendEmail } from "../lib/email";
import { downloadPdf } from "../lib/pdfStorage";
import { logger } from "../lib/logger";

const router = Router();

interface QuoteRow {
  id: string;
  data: unknown;
  quoteNumber: string | null;
  companyName: string | null;
  customerName: string | null;
  createdAt: Date;
  updatedAt: Date;
  passStatus: string | null;
  userId: string;
  pdfSavedAt: Date | null;
  creatorName?: string | null;
  creatorEmail?: string | null;
}

function getMeta(row: QuoteRow): Record<string, string> {
  return ((row.data as Record<string, unknown>)?.meta as Record<string, string>) ?? {};
}

function buildCustomers(rows: QuoteRow[]) {
  const byKey = new Map<string, {
    key: string;
    companyName: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    address: Record<string, string> | null;
    billingAddress: Record<string, string> | null;
    quotes: Array<{
      id: string;
      quoteNumber: string | null;
      passStatus: string | null;
      createdAt: string;
      updatedAt: string;
      data: unknown;
      pdfSavedAt: string | null;
    }>;
    passCount: number;
    failCount: number;
    lastActivity: string;
    creatorName: string | null;
    creatorEmail: string | null;
    userId: string;
  }>();

  for (const row of rows) {
    const meta = getMeta(row);
    const email = (meta.customerEmail ?? "").trim().toLowerCase();
    const key = email || `${(meta.companyName ?? "").trim()}___${(meta.customerName ?? "").trim()}`;
    if (!key || key === "___") continue;

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        companyName: meta.companyName || row.companyName || "",
        customerName: meta.customerName || row.customerName || "",
        customerEmail: email,
        customerPhone: meta.customerPhone || "",
        address: null,
        billingAddress: null,
        quotes: [],
        passCount: 0,
        failCount: 0,
        lastActivity: row.updatedAt.toISOString(),
        creatorName: row.creatorName ?? null,
        creatorEmail: row.creatorEmail ?? null,
        userId: row.userId,
      });
    }

    const c = byKey.get(key)!;

    if (row.updatedAt > new Date(c.lastActivity)) {
      c.lastActivity = row.updatedAt.toISOString();
    }

    if (!c.customerPhone && meta.customerPhone) {
      c.customerPhone = meta.customerPhone;
    }

    if ((meta.addressCity || meta.addressName) && !c.address) {
      c.address = {
        name: meta.addressName || "",
        number: meta.addressNumber || "",
        city: meta.addressCity || "",
        state: meta.addressState || "",
        zip: meta.zipCode || "",
        country: meta.addressCountry || "",
      };
    }

    if (!meta.sameForBilling && (meta.billingAddressCity || meta.billingAddressName) && !c.billingAddress) {
      c.billingAddress = {
        name: meta.billingAddressName || "",
        number: meta.billingAddressNumber || "",
        city: meta.billingAddressCity || "",
        state: meta.billingAddressState || "",
        zip: meta.billingZipCode || "",
        country: meta.billingAddressCountry || "",
      };
    }

    const status = row.passStatus ?? (meta.passStatus as string | undefined) ?? null;
    if (status === "pass") c.passCount++;
    else if (status === "fail") c.failCount++;

    c.quotes.push({
      id: row.id,
      quoteNumber: row.quoteNumber,
      passStatus: status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      data: row.data,
      pdfSavedAt: row.pdfSavedAt ? row.pdfSavedAt.toISOString() : null,
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => (a.companyName || a.customerName).localeCompare(b.companyName || b.customerName));
}

const QUOTE_SELECT = {
  id: quotesTable.id,
  data: quotesTable.data,
  quoteNumber: quotesTable.quoteNumber,
  companyName: quotesTable.companyName,
  customerName: quotesTable.customerName,
  createdAt: quotesTable.createdAt,
  updatedAt: quotesTable.updatedAt,
  passStatus: quotesTable.passStatus,
  userId: quotesTable.userId,
  pdfSavedAt: quotesTable.pdfSavedAt,
  creatorName: usersTable.fullName,
  creatorEmail: usersTable.email,
} as const;

router.get("/customers", requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select(QUOTE_SELECT)
      .from(quotesTable)
      .leftJoin(usersTable, eq(quotesTable.userId, usersTable.id))
      .orderBy(quotesTable.updatedAt);

    const customers = buildCustomers(rows);
    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: "Failed to load customers" });
  }
});

router.get("/admin/customers", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select(QUOTE_SELECT)
      .from(quotesTable)
      .leftJoin(usersTable, eq(quotesTable.userId, usersTable.id))
      .orderBy(quotesTable.updatedAt);

    const customers = buildCustomers(rows);
    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: "Failed to load customers" });
  }
});

router.patch("/admin/customers/:key", requireAdmin, async (req, res) => {
  const key = decodeURIComponent(String(req.params.key));
  const { companyName, customerName, customerEmail, customerPhone } = req.body as {
    companyName?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
  };

  try {
    const allRows = await db.select().from(quotesTable);
    const toUpdate = allRows.filter(r => {
      const meta = getMeta({ data: r.data } as QuoteRow);
      const email = (meta.customerEmail ?? "").trim().toLowerCase();
      const k = email || `${(meta.companyName ?? "").trim()}___${(meta.customerName ?? "").trim()}`;
      return k === key;
    });

    if (toUpdate.length === 0) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    for (const row of toUpdate) {
      const data = row.data as Record<string, unknown>;
      const meta = (data.meta as Record<string, unknown>) ?? {};
      const updatedMeta = {
        ...meta,
        ...(companyName !== undefined && { companyName }),
        ...(customerName !== undefined && { customerName }),
        ...(customerEmail !== undefined && { customerEmail }),
        ...(customerPhone !== undefined && { customerPhone }),
      };
      await db.update(quotesTable)
        .set({
          data: { ...data, meta: updatedMeta },
          ...(companyName !== undefined && { companyName }),
          ...(customerName !== undefined && { customerName }),
          updatedAt: new Date(),
        })
        .where(eq(quotesTable.id, row.id));
    }

    res.json({ updated: toUpdate.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer" });
  }
});

router.delete("/admin/customers/:key", requireAdmin, async (req, res) => {
  const key = decodeURIComponent(String(req.params.key));
  try {
    const allRows = await db
      .select({ id: quotesTable.id, data: quotesTable.data })
      .from(quotesTable);

    const ids = allRows
      .filter(r => {
        const meta = getMeta({ data: r.data } as QuoteRow);
        const email = (meta.customerEmail ?? "").trim().toLowerCase();
        const k = email || `${(meta.companyName ?? "").trim()}___${(meta.customerName ?? "").trim()}`;
        return k === key;
      })
      .map(r => r.id);

    if (ids.length === 0) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    for (const id of ids) {
      await db.delete(quotesTable).where(eq(quotesTable.id, id));
    }

    res.json({ deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

router.post("/customers/send-email", requireAuth, async (req, res) => {
  const { to, subject, body, attachments } = req.body as {
    to: string;
    subject: string;
    body: string;
    attachments?: { type: "quote" | "amendment"; id: string; filename: string }[];
  };
  if (!to || !subject || !body) {
    res.status(400).json({ error: "to, subject, and body are required" });
    return;
  }
  try {
    const emailAttachments: { filename: string; content: Buffer }[] = [];

    if (attachments?.length) {
      for (const a of attachments) {
        try {
          const storagePath = `pdfs/${a.type === "quote" ? "quotes" : "amendments"}/${a.id}.pdf`;
          const buf = await downloadPdf(storagePath);
          if (buf) {
            emailAttachments.push({ filename: a.filename, content: buf });
          } else {
            logger.warn({ id: a.id, type: a.type }, "PDF not found in storage for attachment");
          }
        } catch (attachErr) {
          logger.warn({ attachErr, id: a.id }, "Failed to fetch attachment PDF");
        }
      }
    }

    await sendEmail(
      to,
      subject,
      `<div style="font-family:sans-serif;line-height:1.7;color:#1e293b">${body.replace(/\n/g, "<br>")}</div>`,
      emailAttachments.length ? emailAttachments : undefined,
    );
    res.json({ sent: true });
  } catch (err) {
    logger.error(err, "POST /customers/send-email error");
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
